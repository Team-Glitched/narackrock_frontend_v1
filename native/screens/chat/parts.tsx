import BellIcon from "../../../public/figma/v3-bell.svg";
import { HeaderButton } from "../../ui/header";
import { useScreen } from "../../ui/screen-context";

/** The web's NotificationBell in the chat top bars: unread badge, opens the notifications. */
export function ChatBell() {
  const { act, session } = useScreen();
  const count = session.userId === null ? 0 : session.unreadNotifications;
  return (
    <HeaderButton
      label={count ? `알림, 미확인 ${count}개` : "알림"}
      count={count}
      onPress={() => act({ type: "notifications" })}
    >
      <BellIcon width={22} height={26} />
    </HeaderButton>
  );
}
