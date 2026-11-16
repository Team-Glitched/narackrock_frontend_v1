import { StyleSheet } from "react-native";

import { colors } from "../../ui/theme";

/** The web's auth error text (auth-error, profile-form-error). */
export const errorColor = "#ff9494";

/** The web's auth-screen / profile-onboarding frame and auth-header (logo row). */
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { height: 44, flexDirection: "row", alignItems: "center", paddingLeft: 15 },
});
