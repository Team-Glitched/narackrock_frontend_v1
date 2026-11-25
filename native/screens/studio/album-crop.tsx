import { useRef, useState } from "react";
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type ViewInstance,
} from "react-native";

import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampCrop,
  panCrop,
  pinchCrop,
  type CropPoint,
  type ThumbnailCrop,
} from "../../../src/features/images/image-crop";
import type { NativeAlbumImage } from "../../../src/lib/native-screens";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { Cropped } from "../sources/crop";
import { Dialog, DialogButton, Slider } from "./parts";

type Editor = NonNullable<NativeAlbumImage["editor"]>;
type Gesture =
  | { kind: "pan"; point: CropPoint; crop: ThumbnailCrop }
  | { kind: "pinch"; centre: CropPoint; distance: number; crop: ThumbnailCrop };

const smallPreview = 40;

function fingerPair([first, second]: CropPoint[]) {
  return {
    centre: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}

/**
 * The web's "앨범 이미지 편집" dialog (useImageCrop + ImageCropper, square): one finger moves,
 * two fingers zoom, "확대" slider; "적용" sends the framing (`album-apply`) and the page renders it.
 */
export function AlbumCropDialog({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  return <AlbumCrop editor={editor} />;
}

function AlbumCrop({ editor }: { editor: Editor }) {
  const { act } = useScreen();
  const screen = useWindowDimensions();
  // The web's 300px square; smaller when the window (e.g. landscape) cannot fit the dialog.
  const viewport = Math.max(140, Math.min(300, screen.width - 90, screen.height - 260));
  const image = editor.image.status === "ready" ? editor.image : null;
  const [draft, setDraft] = useState<ThumbnailCrop>(editor.crop);
  const crop = image ? clampCrop(draft, image.width, image.height) : draft;
  const disabled = !image || editor.busy;

  const frame = useRef<ViewInstance>(null);
  const origin = useRef({ x: 0, y: 0 });
  const gesture = useRef<Gesture | null>(null);
  // The dialog body stops scrolling while the frame is held: iOS runs the scroll view's own pan
  // alongside the frame's responder.
  const [held, setHeld] = useState(false);
  const latest = useRef({ crop, image, disabled, viewport });
  latest.current = { crop, image, disabled, viewport };
  const measure = () =>
    frame.current?.measure((_x, _y, _width, _height, pageX, pageY) => {
      origin.current = { x: pageX, y: pageY };
    });
  const points = (event: GestureResponderEvent) =>
    event.nativeEvent.touches.slice(0, 2).map((touch) => ({
      x: touch.pageX - origin.current.x,
      y: touch.pageY - origin.current.y,
    }));
  const restart = (touches: CropPoint[]) => {
    const current = latest.current.crop;
    gesture.current =
      touches.length >= 2
        ? { kind: "pinch", ...fingerPair(touches), crop: current }
        : touches.length === 1
          ? { kind: "pan", point: touches[0], crop: current }
          : null;
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        // The dialog may have scrolled since the frame's last layout.
        measure();
        setHeld(true);
        restart(points(event));
      },
      onPanResponderMove: (event) => {
        const { image: picture, disabled: off, viewport: size } = latest.current;
        const touches = points(event);
        const active = gesture.current;
        if (!picture || off) return;
        // A finger was added or lifted: continue from the current framing.
        if (!active || (active.kind === "pinch") !== touches.length >= 2) return restart(touches);
        const next =
          active.kind === "pinch"
            ? (() => {
                const pair = fingerPair(touches);
                return pinchCrop(
                  active.crop,
                  pair.distance / active.distance,
                  active.centre,
                  pair.centre,
                  picture.width,
                  picture.height,
                  size,
                );
              })()
            : panCrop(
                active.crop,
                touches[0].x - active.point.x,
                touches[0].y - active.point.y,
                picture.width,
                picture.height,
                size,
              );
        latest.current.crop = next;
        setDraft(next);
      },
      onPanResponderRelease: () => {
        gesture.current = null;
        setHeld(false);
      },
      onPanResponderTerminate: () => {
        gesture.current = null;
        setHeld(false);
      },
    }),
  ).current;

  const close = () => act({ type: "album-cancel" });
  return (
    <Dialog label="앨범 이미지 편집" onClose={close} style={styles.dialog}>
      {/* Scrolls when the window (a landscape phone) is shorter than the dialog; the crop frame keeps its own touches. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!held}
        alwaysBounceVertical={false}
        scrollEventThrottle={16}
        onScroll={measure}
      >
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            앨범 이미지 편집
          </Text>
          <Text style={styles.muted}>한 손가락으로 이동하고 두 손가락으로 크기를 조절하세요.</Text>
        </View>
        <View style={styles.editor}>
          <View
            ref={frame}
            onLayout={measure}
            accessible
            accessibilityLabel="앨범 이미지 위치 편집. 한 손가락으로 이동, 두 손가락으로 확대·축소"
            style={[styles.frame, { width: viewport, height: viewport }]}
            {...responder.panHandlers}
          >
            {image && (
              <Cropped
                uri={image.uri}
                image={image}
                crop={crop}
                size={viewport}
                label="앨범 이미지 미리보기"
              />
            )}
            <View pointerEvents="none" style={styles.border} />
          </View>
          {editor.image.status === "failed" && (
            <Text accessibilityRole="alert" style={styles.text}>
              이미지를 미리 볼 수 없습니다. 다른 이미지를 선택해주세요.
            </Text>
          )}
          <View style={styles.zoomRow}>
            <Text style={styles.caption}>확대</Text>
            <Slider
              value={Math.round(crop.zoom * 100)}
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              label="앨범 이미지 확대"
              valueText={`${crop.zoom.toFixed(1)}×`}
              disabled={disabled}
              style={styles.flex}
              onChange={(value) => {
                if (image)
                  setDraft(clampCrop({ ...crop, zoom: value / 100 }, image.width, image.height));
              }}
            />
            <Text style={[styles.caption, styles.zoomValue]}>{crop.zoom.toFixed(1)}×</Text>
          </View>
          <View style={styles.listRow}>
            <View style={styles.small} importantForAccessibility="no-hide-descendants">
              {image && <Cropped uri={image.uri} image={image} crop={crop} size={smallPreview} />}
            </View>
            <Text style={styles.caption}>목록에서는 이렇게 보여요</Text>
          </View>
        </View>
        {editor.gif && (
          <Text style={styles.caption}>GIF는 첫 프레임의 정지 이미지로 저장됩니다.</Text>
        )}
        {editor.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {editor.error}
          </Text>
        )}
        <View style={styles.buttons}>
          <DialogButton label="취소" tone="secondary" disabled={editor.busy} onPress={close} />
          <DialogButton
            label={editor.busy ? "적용 중…" : "적용"}
            disabled={!image || editor.busy}
            onPress={() => act({ type: "album-apply", crop })}
          />
        </View>
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dialog: { paddingHorizontal: 0 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: 16, paddingHorizontal: 20 },
  heading: { gap: 8 },
  title: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  editor: { alignItems: "center", gap: 12 },
  frame: { borderRadius: 4, overflow: "hidden", backgroundColor: colors.surface },
  border: {
    ...StyleSheet.absoluteFill,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.fg,
  },
  text: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  zoomRow: { width: "100%", maxWidth: 260, flexDirection: "row", alignItems: "center", gap: 8 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  zoomValue: { width: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  small: {
    width: smallPreview,
    height: smallPreview,
    overflow: "hidden",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.fg,
    backgroundColor: colors.surface,
  },
  error: { color: "#fca5a5", fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
