import { socialStyles } from "@/styles/social.styles";
import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
export function ChatScreen({ go }: { go: Navigate }) {
  return (
    <div className={socialStyles.chatScreen}>
      <header className={socialStyles.chatHeader}>
        <button aria-label="뒤로" onClick={() => go("friends")}>
          <Asset name="return.svg" />
        </button>
        <h1>채팅</h1>
        <button aria-label="알림" onClick={() => go("notifications")}>
          <Asset name="bell.svg" />
        </button>
        <button aria-label="검색" onClick={() => go("search")}>
          <Asset name="search.svg" />
        </button>
      </header>
      <div className={socialStyles.chatMessages} aria-label="대화 내용">
        <p role="status">현재 채팅을 사용할 수 없습니다.</p>
      </div>
    </div>
  );
}
