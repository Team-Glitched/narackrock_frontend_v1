import type { ScreenRegistry } from "../types";
import { ChatConversationScreen } from "./conversation";
import { ChatInboxScreen } from "./inbox";

/** Native screens of the chat feature; spread into ../index.tsx. */
export const chatScreens: ScreenRegistry<"chat"> = {
  "chat-inbox": ChatInboxScreen,
  "chat-conversation": ChatConversationScreen,
};
