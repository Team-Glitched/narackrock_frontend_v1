import { ChatScreen } from "@/features/social/chat-screen";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function ChatPage() {
  const { go } = useAppNavigation();
  return <ChatScreen go={go} />;
}
