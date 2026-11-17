import { Modal, type ModalProps } from "react-native";

import { useScreen } from "./screen-context";

/**
 * A Modal that belongs to its screen. React Native draws modals in their own window, so hiding a
 * screen (`display: none` in the screen stack) does not hide them: a sheet left open on a screen
 * the user navigated away from would stay up and send its actions to that departed page. This
 * shows the modal only while its screen is the active one.
 */
export function ScreenModal({ visible = true, ...props }: ModalProps) {
  const { active } = useScreen();
  return <Modal {...props} visible={visible && active} />;
}
