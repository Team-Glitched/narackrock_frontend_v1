import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  NativeDialogAction,
  NativeDialogField,
  NativeDialogReport,
} from "../../src/lib/native-dialog";
import { Button, TextField, Touchable } from "./kit";
import { KeyboardAvoiding } from "./keyboard-avoiding";
import { colors, gutter, type } from "./theme";

/** One modal for the topmost controller. Closing a stale controller cannot dismiss another dialog. */
export function Dialog({
  dialog,
  onAction,
}: {
  dialog: NativeDialogReport & { model: NonNullable<NativeDialogReport["model"]> };
  onAction: (action: NativeDialogAction) => void;
}) {
  const { model } = dialog;
  const insets = useSafeAreaInsets();
  const close = () => {
    if (model.dismissible !== false) onAction({ type: "close" });
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <KeyboardAvoiding style={styles.flex}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            <Pressable
              accessible={false}
              onPress={close}
              style={[
                styles.container,
                { paddingTop: insets.top + gutter, paddingBottom: insets.bottom + gutter },
              ]}
            >
              <Pressable
                accessible={false}
                onPress={(event) => event.stopPropagation()}
                style={styles.panel}
                accessibilityViewIsModal
              >
                <Text style={type.title} accessibilityRole="header">
                  {model.title}
                </Text>
                {model.message ? <Text style={type.body}>{model.message}</Text> : null}
                {model.fields?.map((field) => (
                  <Field
                    key={field.id}
                    field={field}
                    onChange={(value) => onAction({ type: "change", id: field.id, value })}
                  />
                ))}
                {model.error ? (
                  <Text accessibilityRole="alert" style={[type.body, styles.error]}>
                    {model.error}
                  </Text>
                ) : null}
                {model.actions.map((action) => (
                  <Button
                    key={action.id}
                    label={action.label}
                    disabled={action.disabled}
                    tone={action.destructive ? "danger" : "secondary"}
                    onPress={() => onAction({ type: "action", id: action.id })}
                  />
                ))}
                {model.dismissible !== false && (
                  <Button label="닫기" tone="secondary" onPress={close} />
                )}
              </Pressable>
            </Pressable>
          </ScrollView>
        </KeyboardAvoiding>
      </View>
    </Modal>
  );
}

function Field({
  field,
  onChange,
}: {
  field: NativeDialogField;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(field.value);
  const focused = useRef(false);
  // Keep local typing ahead of delayed bridge echoes; sync external changes while not editing.
  useEffect(() => {
    if (!focused.current) setValue(field.value);
  }, [field.value]);
  return (
    <View style={styles.field}>
      <Text style={type.body}>{field.label}</Text>
      {field.options ? (
        <View accessibilityRole="radiogroup">
          {field.options.map((option) => (
            <Touchable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{
                checked: field.value === option.value,
                disabled: field.disabled,
              }}
              disabled={field.disabled}
              style={styles.option}
              onPress={() => onChange(option.value)}
            >
              <Text style={type.body}>
                {field.value === option.value ? "● " : "○ "}
                {option.label}
              </Text>
            </Touchable>
          ))}
        </View>
      ) : (
        <TextField
          accessibilityLabel={field.label}
          value={value}
          multiline={field.multiline}
          keyboardType={field.keyboard ?? "default"}
          editable={!field.disabled}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            setValue(field.value);
          }}
          onChangeText={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: gutter },
  panel: {
    backgroundColor: colors.bg,
    borderRadius: 16,
    padding: gutter,
    gap: 16,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  field: { gap: 8 },
  option: { paddingVertical: 12 },
  error: { color: colors.error },
});
