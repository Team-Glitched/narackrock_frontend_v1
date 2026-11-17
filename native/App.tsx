import Server from "@dr.pogodin/react-native-static-server";
import {
  copyFileAssets,
  DocumentDirectoryPath,
  exists,
  MainBundlePath,
  readFile,
  readFileAssets,
  unlink,
  writeFile,
} from "@dr.pogodin/react-native-fs";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { NativeFooter } from "../src/lib/native-bridge-protocol";
import type { NativeScreenAction, NativeSession } from "../src/lib/native-screens";
import { designTokens } from "../src/styles/tokens";
import {
  cancelRecording,
  disposeAudioEngines,
  onAudioState,
  requestMicrophoneAtLaunch,
} from "./audio";
import {
  appBackgroundScript,
  audioStateScript,
  closeModalScript,
  footerPressScript,
  handleRequest,
  historyBackScript,
  injectedBeforeContentLoaded,
  parseRequest,
  responseScript,
  screenActionScript,
  userAgentToken,
} from "./bridge";
import { emptyStack, reduceStack, ScreenStack } from "./screen-stack";
import { footerFrame, TabBar, type Viewport } from "./tab-bar";

const signedOut: NativeSession = {
  userId: null,
  profileImageUrl: null,
  unreadNotifications: 0,
  unreadChats: 0,
};

// The web app stores auth and drafts in localStorage, which is keyed by origin,
// so the port must stay fixed across launches. The backend CORS allow-list must
// include http://127.0.0.1:17173.
const PORT = 17173;
const WEBROOT = "webroot";
// Written by scripts/build-native-web.mjs next to index.html.
const MANIFEST_FILE = "native-build.json";
const BACKGROUND = designTokens.colors.bg;

type WebBuildManifest = { buildId: string; apiOrigin: string };

/** Returns an on-device folder holding the bundled web build, ready to be served. */
async function prepareWebroot(): Promise<{ fileDir: string; manifest: WebBuildManifest }> {
  if (Platform.OS !== "android") {
    const fileDir = `${MainBundlePath}/${WEBROOT}`;
    const manifest = JSON.parse(await readFile(`${fileDir}/${MANIFEST_FILE}`, "utf8"));
    return { fileDir, manifest };
  }

  // Android assets live inside the APK, so the server needs an extracted copy. The marker naming the
  // extracted build is written only after the copy finishes, so an interrupted copy is redone.
  const fileDir = `${DocumentDirectoryPath}/${WEBROOT}`;
  const markerPath = `${DocumentDirectoryPath}/${WEBROOT}.build-id`;
  const manifest: WebBuildManifest = JSON.parse(
    await readFileAssets(`${WEBROOT}/${MANIFEST_FILE}`, "utf8"),
  );
  const extractedId = (await exists(markerPath)) ? await readFile(markerPath, "utf8") : null;
  if (extractedId !== manifest.buildId) {
    if (await exists(markerPath)) await unlink(markerPath);
    if (await exists(fileDir)) await unlink(fileDir);
    await copyFileAssets(WEBROOT, fileDir);
    await writeFile(markerPath, manifest.buildId, "utf8");
  }
  return { fileDir, manifest };
}

function serverConfig(apiOrigin: string): string {
  return [
    // History-API routes (createBrowserRouter) must resolve to the SPA entry on reload.
    'server.error-handler-404 = "/index.html"',
    // The web ingress routes legacy relative /files/... URLs to the backend; mirror that. 302, not
    // lighttpd's default 301: the fixed origin would keep a permanent redirect cached across API changes.
    'server.modules += ("mod_redirect")',
    `url.redirect = ("^/files/(.*)$" => "${apiOrigin}/files/$1")`,
    "url.redirect-code = 302",
  ].join("\n");
}

function useLocalWebServer() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let server: Server | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { fileDir, manifest } = await prepareWebroot();
        if (cancelled) return;
        server = new Server({
          fileDir,
          port: PORT,
          // Paired with the background pause below: playback stops first, so nothing needs the
          // server while the app is away. The library restarts it on return.
          stopInBackground: true,
          extraConfig: serverConfig(manifest.apiOrigin),
        });
        const started = await server.start();
        if (!cancelled) setOrigin(started);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
      setOrigin(null);
      server?.stop();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { origin, error, retry };
}

function WebShell() {
  const { origin, error, retry } = useLocalWebServer();
  const webView = useRef<WebView<object>>(null);
  // Reported by the web (set-history); see that method in the bridge protocol.
  const canGoBack = useRef(false);
  // The page's footer, drawn natively by TabBar over the web's inert footer row.
  const [footer, setFooter] = useState<NativeFooter | null>(null);
  // Native screens of recent history entries (see screen-stack.tsx) and what their headers show.
  const [stack, setStack] = useState(emptyStack);
  const [session, setSession] = useState(signedOut);
  // A web modal must be visible and reachable, so native views above the WebView step aside.
  const [modalOpen, setModalOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // A restarted page reports its native views again once mounted.
  const reload = useCallback(() => {
    setFooter(null);
    setStack(emptyStack);
    setModalOpen(false);
    canGoBack.current = false;
    webView.current?.reload();
  }, []);
  const onScreenAction = useCallback(
    (key: string, action: NativeScreenAction) =>
      webView.current?.injectJavaScript(screenActionScript(key, action)),
    [],
  );
  // A page (re)load ends every audio scope of the previous document.
  const resetAudio = useCallback(() => {
    disposeAudioEngines();
    cancelRecording();
  }, []);

  // Audio engine transports reach the page like screen actions (see `onNativeAudioState`).
  useEffect(
    () => onAudioState((state) => webView.current?.injectJavaScript(audioStateScript(state))),
    [],
  );

  // The microphone is asked for at launch; recording asks again while it is missing.
  useEffect(() => {
    requestMicrophoneAtLaunch().catch(() => {});
  }, []);

  // Back closes an open web modal first, then walks the SPA history, then leaves the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modalOpen) webView.current?.injectJavaScript(closeModalScript);
      else if (canGoBack.current) webView.current?.injectJavaScript(historyBackScript);
      else return false;
      return true;
    });
    return () => subscription.remove();
  }, [modalOpen]);

  // Leaving the foreground pauses playback on both platforms (Android would otherwise keep playing).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") webView.current?.injectJavaScript(appBackgroundScript);
    });
    return () => subscription.remove();
  }, []);

  // Like a native tab bar, the footer gives way to the keyboard.
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // Keep the app on its own origin; send top-level navigation elsewhere to the system browser.
  const onShouldStartLoadWithRequest = useCallback(
    (request: { url: string; isTopFrame?: boolean }) => {
      if (!origin || request.isTopFrame === false) return true;
      if (request.url.startsWith(`${origin}/`) || request.url.startsWith("about:")) return true;
      void Linking.openURL(request.url);
      return false;
    },
    [origin],
  );

  // Requests must come from the bundled app and carry the main-frame-only token (checked in
  // parseRequest). Android reports the sending frame's origin (no path); iOS the page URL.
  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const { url, data } = event.nativeEvent;
      if (!origin || (url !== origin && !url.startsWith(`${origin}/`))) return;
      const request = parseRequest(data);
      if (!request) return;
      void handleRequest(request, {
        origin,
        setFooter,
        setScreen: (report) => setStack((state) => reduceStack(state, report)),
        setSession,
        setModal: setModalOpen,
        setCanGoBack: (value) => {
          canGoBack.current = value;
        },
      }).then((response) => webView.current?.injectJavaScript(responseScript(response)));
    },
    [origin],
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>앱을 시작하지 못했습니다.</Text>
        <Text style={styles.detail}>{error}</Text>
        <Pressable style={styles.button} onPress={retry}>
          <Text style={styles.message}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  if (!origin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  // The web page under a native screen hides itself from screen readers (useNativeScreen).
  // Content scrolls under the tab bar only when the page has one.
  const bottomInset = footer && viewport ? viewport.height - footerFrame(viewport).top : 0;
  return (
    <View
      style={styles.webView}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport({ width, height });
      }}
    >
      {/* react-native-webview types default P to undefined, which collapses props to never. */}
      <WebView<object>
        ref={webView}
        source={{ uri: `${origin}/` }}
        style={styles.webView}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        webviewDebuggingEnabled={__DEV__}
        applicationNameForUserAgent={userAgentToken}
        injectedJavaScriptBeforeContentLoaded={injectedBeforeContentLoaded}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        onLoadStart={resetAudio}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onContentProcessDidTerminate={reload}
        onRenderProcessGone={reload}
      />
      <ScreenStack
        stack={stack}
        hidden={modalOpen}
        session={session}
        origin={origin}
        bottomInset={bottomInset}
        onAction={onScreenAction}
      />
      {footer && viewport && !keyboardVisible && !modalOpen && (
        <TabBar
          footer={footer}
          viewport={viewport}
          onPress={(press) => webView.current?.injectJavaScript(footerPressScript(press))}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <WebShell />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  webView: { flex: 1, backgroundColor: BACKGROUND },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: BACKGROUND,
  },
  message: { color: "#ffffff", fontSize: 16 },
  detail: { color: "#9a9a9a", fontSize: 13, textAlign: "center" },
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#333333",
  },
});
