import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  formatProfileInstruments,
  instrumentGroups,
  parseProfileInstruments,
  partLabel,
} from "../../../src/features/composition/instrument-parts";
import { Touchable } from "../../ui/kit";
import { colors, type } from "../../ui/theme";
import { Dialog, DialogButton } from "../studio/parts";

/** Multi-select instrument dialog for native profile edit and onboarding screens; render outside ScrollView. */
export function ProfileInstrumentDialog({
  value,
  onConfirm,
  onClose,
  allowEmpty = true,
  subtitle = "프로필에 표시할 악기나 보컬 파트를 여러 개 선택할 수 있어요.",
}: {
  value: string;
  onConfirm: (formatted: string) => void;
  onClose: () => void;
  allowEmpty?: boolean;
  subtitle?: string;
}) {
  const parsed = parseProfileInstruments(value);
  const [selectedIds, setSelectedIds] = useState<string[]>(parsed.selectedIds);
  const [customLabels, setCustomLabels] = useState<string[]>(parsed.customLabels);
  const totalCount = selectedIds.length + customLabels.length;
  const toggle = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };
  const canConfirm = allowEmpty || totalCount > 0;

  return (
    <Dialog label="악기 선택" onClose={onClose} style={styles.dialog}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          악기 선택
        </Text>
        {totalCount > 0 && (
          <Touchable
            accessibilityRole="button"
            onPress={() => {
              setSelectedIds([]);
              setCustomLabels([]);
            }}
          >
            <Text style={styles.clearLink}>전체 해제</Text>
          </Touchable>
        )}
      </View>
      <Text style={type.muted}>
        {subtitle} ({totalCount}개 선택)
      </Text>
      <ScrollView
        nestedScrollEnabled
        style={styles.list}
        contentContainerStyle={styles.groups}
        accessibilityLabel="악기"
      >
        {instrumentGroups.map((group) => (
          <View key={group.id}>
            <Text style={styles.legend}>{group.label}</Text>
            <View style={styles.parts}>
              {group.instruments.map((id) => {
                const checked = selectedIds.includes(id);
                return (
                  <Touchable
                    key={id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    style={[styles.part, checked && styles.partChecked]}
                    onPress={() => toggle(id)}
                  >
                    <Text style={styles.partText}>{partLabel(id)}</Text>
                  </Touchable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <DialogButton label="취소" tone="secondary" onPress={onClose} />
        <DialogButton
          label="선택 완료"
          disabled={!canConfirm}
          onPress={() => {
            onConfirm(formatProfileInstruments(selectedIds, customLabels));
            onClose();
          }}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  heading: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  clearLink: { color: colors.muted, fontSize: 12, lineHeight: 16, textDecorationLine: "underline" },
  list: { maxHeight: 320, flexGrow: 0 },
  groups: { gap: 16 },
  legend: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "700", marginBottom: 8 },
  parts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  part: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  partChecked: { backgroundColor: colors.primary },
  partText: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
