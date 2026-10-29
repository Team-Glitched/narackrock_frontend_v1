import { ChatScreen } from "@/features/screens/chat-screen";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
export default function ChatPage() {
  const { go } = useAppNavigation();
  return <ChatScreen go={go} />;
}
