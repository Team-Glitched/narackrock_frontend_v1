import { Pressable, StyleSheet, Text, View } from "react-native";

import { Touchable } from "./kit";
import type { MenuTarget } from "./screen-context";
import { ScreenModal } from "./screen-modal";
import { colors } from "./theme";

/** Share/report sheet of a card; the web performs both (login check, share link, report form). */
export function ContentMenu({
  target,
  canReport,
  onClose,
  onChoose,
  onDismiss,
}: {
  target: MenuTarget | null;
  canReport: boolean;
  onClose: () => void;
  onChoose: (type: "share" | "report", target: MenuTarget) => void;
  /** iOS: the menu's modal has finished dismissing (a modal that presented it may close now). */
  onDismiss?: () => void;
}) {
  const choose = (type: "share" | "report") => {
    if (!target) return;
    onClose();
    onChoose(type, target);
  };
  return (
    <ScreenModal
      visible={target !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityRole="menu">
          <Text style={styles.title} numberOfLines={1}>
            {target?.title}
          </Text>
          <Item label="공유" onPress={() => choose("share")} />
          {canReport && <Item label="신고" onPress={() => choose("report")} />}
          <Item label="취소" muted onPress={onClose} />
        </View>
      </View>
    </ScreenModal>
  );
}

function Item({
  label,
  muted = false,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable accessibilityRole="menuitem" style={styles.item} onPress={onPress}>
      <Text style={[styles.itemText, muted && { color: colors.muted }]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  sheet: {
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  title: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  item: { height: 56, justifyContent: "center", paddingHorizontal: 20 },
  itemText: { color: colors.fg, fontSize: 16, textAlign: "center" },
});
