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
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Dimensions,
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
import type { NativeDialogReport } from "../src/lib/native-dialog";
import { Dialog } from "./ui/dialog";
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
  dialogActionScript,
  footerPressScript,
  handleRequest,
  historyBackScript,
  injectedBeforeContentLoaded,
  parseRequest,
  responseScript,
  screenActionScript,
  userAgentToken,
} from "./bridge";
import {
  initialNativeOrientation,
  reduceNativeOrientation,
  resolveNativeLockMode,
  runWithPortraitAllowed,
  type NativeLockMode,
  type NativeOrientationState,
} from "../src/lib/native-orientation";
import { canvasKinds, emptyStack, reduceStack, ScreenStack } from "./screen-stack";
import { footerFrame, headerTop, TabBar, type Viewport } from "./tab-bar";

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
// The web build the WebView last loaded, written once its HTTP cache was cleared for that build.
const LOADED_BUILD_PATH = `${DocumentDirectoryPath}/${WEBROOT}.loaded-build-id`;
const BACKGROUND = designTokens.colors.bg;
// The launch splash stays up until the first native screen (or the start error) replaces it, so
// no blank frame or spinner shows in between. A page that never reports a screen still gets the
// loading view after this long.
const SPLASH_MAX_MS = 8000;

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 200, fade: true });
void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

type WebBuildManifest = { buildId: string; apiOrigin: string };

/**
 * Returns an on-device folder holding the bundled web build, ready to be served, and whether the
 * WebView has not loaded this build yet (its HTTP cache may still hold the previous build's pages).
 */
async function prepareWebroot(): Promise<{
  fileDir: string;
  manifest: WebBuildManifest;
  newBuild: boolean;
}> {
  const loadedId = (await exists(LOADED_BUILD_PATH))
    ? await readFile(LOADED_BUILD_PATH, "utf8")
    : null;
  if (Platform.OS !== "android") {
    const fileDir = `${MainBundlePath}/${WEBROOT}`;
    const manifest: WebBuildManifest = JSON.parse(
      await readFile(`${fileDir}/${MANIFEST_FILE}`, "utf8"),
    );
    return { fileDir, manifest, newBuild: loadedId !== manifest.buildId };
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
  return { fileDir, manifest, newBuild: loadedId !== manifest.buildId };
}

function serverConfig(apiOrigin: string): string {
  return [
    // History-API routes (createBrowserRouter) must resolve to the SPA entry on reload.
    'server.error-handler-404 = "/index.html"',
    // The web ingress routes legacy relative /files/... URLs to the backend; mirror that. 302, not
    // lighttpd's default 301: the fixed origin would keep a permanent redirect cached across API changes.
    'server.modules += ("mod_redirect", "mod_setenv")',
    `url.redirect = ("^/files/(.*)$" => "${apiOrigin}/files/$1")`,
    "url.redirect-code = 302",
    // Every app update serves a new build from the same origin. Without a cache header the WebView
    // reuses a cached index.html (and through it the previous build) for a while after an update;
    // only the content-hashed /assets/ files may be reused without asking.
    '$HTTP["url"] !~ "^/assets/" { setenv.add-response-header = ("Cache-Control" => "no-cache") }',
  ].join("\n");
}

function useLocalWebServer() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A build the WebView has not loaded yet: its cache is cleared before the first page load.
  const [newBuildId, setNewBuildId] = useState<string | null>(null);

  useEffect(() => {
    let server: Server | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { fileDir, manifest, newBuild } = await prepareWebroot();
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
        if (!cancelled) {
          setNewBuildId(newBuild ? manifest.buildId : null);
          setOrigin(started);
        }
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

  // Called once the WebView's cache is cleared: later launches of this build load straight away.
  const buildLoaded = useCallback(() => {
    if (newBuildId === null) return;
    void writeFile(LOADED_BUILD_PATH, newBuildId, "utf8").catch(() => {});
    setNewBuildId(null);
  }, [newBuildId]);

  return { origin, error, retry, cacheStale: newBuildId !== null, buildLoaded };
}

function toExpoOrientationLock(mode: NativeLockMode): ScreenOrientation.OrientationLock {
  if (mode === "landscape") return ScreenOrientation.OrientationLock.LANDSCAPE;
  if (mode === "default") return ScreenOrientation.OrientationLock.DEFAULT;
  return ScreenOrientation.OrientationLock.PORTRAIT_UP;
}

function WebShell() {
  const { origin, error, retry, cacheStale, buildLoaded } = useLocalWebServer();
  const webView = useRef<WebView<object>>(null);
  // Reported by the web (set-history); see that method in the bridge protocol.
  const canGoBack = useRef(false);
  // The page reports the footer model; no web footer is mounted.
  const [footer, setFooter] = useState<NativeFooter | null>(null);
  // Native screens of recent history entries (see screen-stack.tsx) and what their headers show.
  const [stack, setStack] = useState(emptyStack);
  const [overlayStack, setOverlayStack] = useState(emptyStack);
  const [session, setSession] = useState(signedOut);
  const [dialogs, setDialogs] = useState<NativeDialogReport[]>([]);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // The screen on display; hardware Back goes to its page like the header's back button.
  const shownScreen = useRef<string | null>(null);
  shownScreen.current = overlayStack.current ?? stack.current;
  const activeStack = overlayStack.current !== null ? overlayStack : stack;
  const activeView = activeStack.entries.find((entry) => entry.key === activeStack.current)?.view;
  const reportedCanvas = activeView === undefined ? null : canvasKinds.has(activeView.kind);
  const [orientation, setOrientation] = useState<NativeOrientationState>(initialNativeOrientation);
  const nextOrientation = reduceNativeOrientation(orientation, reportedCanvas);
  if (nextOrientation !== orientation) setOrientation(nextOrientation);
  const orientationRef = useRef<NativeOrientationState>(nextOrientation);
  orientationRef.current = nextOrientation;
  const [portraitRequests, setPortraitRequests] = useState(0);
  const portraitRequestsRef = useRef(0);
  const toggleOrientation = useCallback(() => {
    const { width, height } = Dimensions.get("screen");
    const nextManual = height >= width ? "landscape" : "portrait";
    setOrientation((current) => ({ ...current, manualOrientation: nextManual }));
  }, []);
  const lockMode = resolveNativeLockMode(nextOrientation, portraitRequests);
  useEffect(() => {
    void ScreenOrientation.lockAsync(toExpoOrientationLock(lockMode)).catch(() => {});
  }, [lockMode]);
  const withPortraitAllowed = useCallback(
    <T,>(task: () => Promise<T>) =>
      runWithPortraitAllowed({
        getState: () => orientationRef.current,
        countRef: portraitRequestsRef,
        onCountChange: setPortraitRequests,
        applyLock: (mode) => ScreenOrientation.lockAsync(toExpoOrientationLock(mode)),
        task,
      }),
    [],
  );
  const launched = stack.current !== null || error !== null;
  useEffect(() => {
    if (launched) SplashScreen.hide();
  }, [launched]);
  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hide(), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);
  // A restarted page reports its native views again once mounted.
  const reload = useCallback(() => {
    setFooter(null);
    setStack(emptyStack);
    setOverlayStack(emptyStack);
    setDialogs([]);
    setOrientation(initialNativeOrientation);
    canGoBack.current = false;
    webView.current?.reload();
  }, []);
  const onScreenAction = useCallback(
    (key: string, action: NativeScreenAction) =>
      webView.current?.injectJavaScript(screenActionScript(key, action)),
    [],
  );

  // Audio engine transports reach the page like screen actions (see `onNativeAudioState`).
  useEffect(
    () => onAudioState((state) => webView.current?.injectJavaScript(audioStateScript(state))),
    [],
  );

  // The microphone is asked for at launch; recording asks again while it is missing.
  useEffect(() => {
    requestMicrophoneAtLaunch().catch(() => {});
  }, []);

  // Native dialogs and sheets handle Back themselves (Modal onRequestClose, sheet listeners). Otherwise
  // Back is the shown screen's back action, so its page runs the same leave flow as the header's back
  // button (the piano roll's draft choice, an empty new layer's cleanup) instead of a bare
  // history.back(). On the first entry it leaves the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      const key = shownScreen.current;
      webView.current?.injectJavaScript(
        key ? screenActionScript(key, { type: "back" }) : historyBackScript,
      );
      return true;
    });
    return () => subscription.remove();
  }, []);

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
        setScreen: (report) =>
          (report.overlay ? setOverlayStack : setStack)((state) => reduceStack(state, report)),
        setSession,
        setDialog: (dialog) =>
          setDialogs((current) => {
            if (dialog.model === null) return current.filter((item) => item.id !== dialog.id);
            const index = current.findIndex((item) => item.id === dialog.id);
            return index === -1
              ? [...current, dialog]
              : current.map((item) => (item.id === dialog.id ? dialog : item));
          }),
        setCanGoBack: (value) => {
          canGoBack.current = value;
        },
        // A new document ends every audio scope of the previous one. WebView load events cannot
        // tell: Android also fires them on SPA history changes, which would wipe the new page's engine.
        documentStart: () => {
          disposeAudioEngines();
          cancelRecording();
        },
        withPortraitAllowed,
      }).then((response) => webView.current?.injectJavaScript(responseScript(response)));
    },
    [origin, withPortraitAllowed],
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

  // WebView is a nonvisual controller. Native UI is the only visible and accessible layer.
  const bottomInset = footer && viewport ? viewport.height - footerFrame(viewport).top : 0;
  const topInset = viewport ? headerTop(viewport) : 0;
  const dialog = dialogs.at(-1);
  return (
    <View
      style={styles.webView}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport({ width, height });
      }}
    >
      <View
        style={styles.controller}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {/* react-native-webview types default P to undefined, which collapses props to never. */}
        <WebView<object>
          ref={webView}
          // After an update a blank page loads first, so the cache can be cleared before the app's
          // page: a cached index.html would otherwise start the previous build.
          source={cacheStale ? { html: "" } : { uri: `${origin}/` }}
          onLoadEnd={() => {
            if (!cacheStale) return;
            webView.current?.clearCache?.(true);
            buildLoaded();
          }}
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
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onContentProcessDidTerminate={reload}
          onRenderProcessGone={reload}
        />
      </View>
      {stack.current === null && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator color="#ffffff" />
        </View>
      )}
      <ScreenStack
        stack={stack}
        hidden={overlayStack.current !== null}
        session={session}
        origin={origin}
        bottomInset={bottomInset}
        topInset={topInset}
        onAction={onScreenAction}
        onToggleOrientation={toggleOrientation}
      />
      {overlayStack.current !== null && (
        <ScreenStack
          stack={overlayStack}
          hidden={false}
          session={session}
          origin={origin}
          bottomInset={0}
          topInset={topInset}
          onAction={onScreenAction}
          onToggleOrientation={toggleOrientation}
        />
      )}
      {footer && viewport && !keyboardVisible && overlayStack.current === null && (
        <TabBar
          footer={footer}
          viewport={viewport}
          onPress={(press) => webView.current?.injectJavaScript(footerPressScript(press))}
        />
      )}
      {dialog?.model && (
        <Dialog
          key={dialog.id}
          dialog={{ id: dialog.id, model: dialog.model }}
          onAction={(action) =>
            webView.current?.injectJavaScript(dialogActionScript(dialog.id, action))
          }
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Left/right: in landscape the navigation bar or display cutout sits at a side edge. */}
      <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
        <StatusBar style="light" />
        <WebShell />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  webView: { flex: 1, backgroundColor: BACKGROUND },
  controller: { ...StyleSheet.absoluteFill, opacity: 0 },
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
