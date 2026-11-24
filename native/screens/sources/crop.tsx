import { useEffect, useRef, useState } from "react";
import { Image, PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampCrop,
  cropDisplay,
  defaultCrop,
  panCrop,
  type ThumbnailCrop,
} from "../../../src/features/sources/thumbnail-crop";
import type { NativeSourceCreate } from "../../../src/lib/native-screens";
import { Button, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { Dialog, Slider } from "../studio/parts";

/** Square editing area; the inscribed circle is exactly what list and detail cards show. */
const viewport = 300;
const smallPreview = 40;

type Form = Extract<NativeSourceCreate, { state: "form" }>;

/**
 * The web's "앨범" crop dialog (ThumbnailCropper): drag to move, "확대" to zoom. The framing is
 * edited here and sent shortly after each change (`source-create-crop`); "완료" closes it.
 */
export function CropSheet({ model }: { model: Form }) {
  const { act } = useScreen();
  const image = model.image?.status === "ready" ? model.image : null;
  const [draft, setDraft] = useState<ThumbnailCrop | null>(null);
  // The page echoes the sent framing; then the model's value is shown again.
  if (
    draft &&
    draft.zoom === model.crop.zoom &&
    draft.x === model.crop.x &&
    draft.y === model.crop.y
  )
    setDraft(null);
  const crop = image ? clampCrop(draft ?? model.crop, image.width, image.height) : model.crop;
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => act({ type: "source-create-crop", crop: draft }), 120);
    return () => clearTimeout(timer);
  }, [act, draft]);

  const start = useRef<ThumbnailCrop | null>(null);
  const latest = useRef({ crop, image, disabled: model.busy });
  latest.current = { crop, image, disabled: model.busy };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!latest.current.image && !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !!latest.current.image && !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.crop;
      },
      onPanResponderMove: (_, gesture) => {
        const picture = latest.current.image;
        if (!start.current || !picture) return;
        setDraft(
          panCrop(start.current, gesture.dx, gesture.dy, picture.width, picture.height, viewport),
        );
      },
      onPanResponderRelease: () => {
        start.current = null;
      },
      onPanResponderTerminate: () => {
        start.current = null;
      },
    }),
  ).current;

  const close = () => {
    if (draft) act({ type: "source-create-crop", crop: draft });
    act({ type: "source-create-crop-done" });
  };
  const disabled = !image || model.busy;
  return (
    <Dialog label="앨범" onClose={close} style={styles.dialog}>
      <Text accessibilityRole="header" style={styles.title}>
        앨범
      </Text>
      <View style={styles.editor}>
        <View
          accessibilityLabel="앨범 이미지 위치 편집. 끌어서 이동, 방향키로 미세 이동"
          style={styles.frame}
          {...responder.panHandlers}
        >
          {image && <Cropped uri={image.uri} image={image} crop={crop} size={viewport} />}
          <Svg
            width={viewport}
            height={viewport}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Path
              fillRule="evenodd"
              fill="rgba(0, 0, 0, 0.4)"
              d={`M0 0H${viewport}V${viewport}H0Z M${viewport / 2} 0A${viewport / 2} ${viewport / 2} 0 1 0 ${viewport / 2} ${viewport}A${viewport / 2} ${viewport / 2} 0 1 0 ${viewport / 2} 0Z`}
            />
          </Svg>
          <View pointerEvents="none" style={styles.ring} />
        </View>
        {model.image?.status === "failed" && (
          <Text accessibilityRole="alert" style={styles.alert}>
            앨범 이미지를 미리 볼 수 없습니다. 다른 이미지를 선택해주세요.
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
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            style={disabled && styles.disabled}
            onPress={() => setDraft(defaultCrop())}
          >
            <Text style={[styles.caption, styles.reset]}>처음 위치로</Text>
          </Touchable>
        </View>
      </View>
      <Button label="완료" onPress={close} />
    </Dialog>
  );
}

/** The picture placed so the crop fills a `size` square (the web's cropDisplay). */
function Cropped({
  uri,
  image,
  crop,
  size,
}: {
  uri: string;
  image: { width: number; height: number };
  crop: ThumbnailCrop;
  size: number;
}) {
  const { uri: resolve } = useScreen();
  const place = cropDisplay(crop, image.width, image.height, size);
  return (
    <Image
      source={{ uri: resolve(uri)! }}
      accessibilityLabel={size === viewport ? "앨범 이미지 미리보기" : undefined}
      style={{
        position: "absolute",
        left: place.left,
        top: place.top,
        width: place.width,
        height: place.height,
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dialog: { width: 390, borderRadius: 16, backgroundColor: colors.panel, gap: 16 },
  title: { color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  editor: { alignItems: "center", gap: 12 },
  frame: {
    width: viewport,
    height: viewport,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: viewport / 2,
    borderWidth: 2,
    borderColor: colors.fg,
  },
  alert: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  zoomRow: { width: "100%", maxWidth: 260, flexDirection: "row", alignItems: "center", gap: 8 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  zoomValue: { width: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  small: {
    width: smallPreview,
    height: smallPreview,
    borderRadius: smallPreview / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.fg,
    backgroundColor: colors.surface,
  },
  reset: { textDecorationLine: "underline" },
  disabled: { opacity: 0.4 },
});
