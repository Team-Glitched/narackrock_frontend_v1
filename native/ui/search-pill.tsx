import { useRef, useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import CloseIcon from "../../public/figma/search-close.svg";
import SearchIcon from "../../public/figma/search-input.svg";
import { Touchable } from "./kit";
import { colors } from "./theme";

/**
 * The web's search pill (chat inbox, /search, community picker; socialStyles.searchFocus). The border
 * width is always reserved, so focus only recolors it and the field never shifts.
 */
export function SearchPill({
  value,
  onChangeText,
  onClear,
  clearLabel,
  style,
  ...input
}: Pick<TextInputProps, "placeholder" | "accessibilityLabel" | "autoFocus" | "returnKeyType"> & {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  clearLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.pill, focused && styles.focused, style]}>
      <SearchIcon width={19} height={19} />
      <TextInput
        {...input}
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={styles.input}
      />
      {value !== "" && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          style={styles.clear}
          onPress={() => {
            onClear();
            ref.current?.focus();
          }}
        >
          <CloseIcon width={13} height={13} />
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.accent },
  input: { flex: 1, minWidth: 0, padding: 0, color: colors.fg, fontSize: 16 },
  clear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
