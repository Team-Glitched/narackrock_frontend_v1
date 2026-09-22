"use client";

import { useEffect, useRef, useState } from "react";
import {
  Asset,
  Avatar,
  postImages,
  SectionTitle,
  SongRail,
} from "@/components/app/shared";
import { AbyssComments } from "@/features/screens/abyss-comments";
import type { Navigate } from "@/features/navigation/types";

const sampleText =
  "미안하다 이거 보여주려고 어그로끌었다.. 나루토 사스케 싸움수준 ㄹㅇ실화냐? 진...";
function MiniPost({
  tall = false,
  index = 0,
  onOpen,
  onProfile,
}: {
  tall?: boolean;
  index?: number;
  onOpen?: () => void;
  onProfile?: () => void;
}) {
  const [liked, setLiked] = useState(false);
  return (
    <article className={`mini-post ${tall ? "mini-post--tall" : ""}`}>
      {/* 제목/사진을 누르면 인기글 상세로 이동한다. */}
      <button className="post-thumb" onClick={onOpen} aria-label="게시글 보기">
        <Asset
          name={postImages[index % postImages.length]}
          alt="게시물 이미지"
        />
        <b>재즈</b>
      </button>
      <div className="mini-post-copy">
        <button className="mini-title" onClick={onOpen}>
          {sampleText}
        </button>
        <div className="mini-meta">
          <span>1초 전</span>
          <button
            className={`mini-like${liked ? " liked" : ""}`}
            aria-label="좋아요"
            aria-pressed={liked}
            onClick={() => setLiked((v) => !v)}
          >
            <Asset name={liked ? "like-filled.svg" : "like.svg"} />
            {5 + (liked ? 1 : 0)}
          </button>
          <button className="mini-comment" aria-label="댓글" onClick={onOpen}>
            <Asset name="comment.svg" />5
          </button>
        </div>
        {/* 작성자 프로필/이름을 누르면 그 사람 프로필로 이동한다. */}
        <button className="mini-author" onClick={onProfile}>
          <Avatar />
          <span>min chong</span>
        </button>
      </div>
    </article>
  );
}
function BackTitle({ title, go }: { title: string; go: Navigate }) {
  return (
    <div className="back-title">
      <button aria-label="뒤로" onClick={() => go("home")}>
        <Asset name="return.svg" />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function HomeScreen({ go }: { go: Navigate }) {
  return (
    <div className="home-content scroll-content">
      <section>
        <SectionTitle onAll={() => go("charts")}>인기 곡</SectionTitle>
        <SongRail onSelect={() => go("abyss")} />
      </section>
      <section>
        <SectionTitle onAll={() => go("posts")}>인기 글</SectionTitle>
        <div className="mini-post-list">
          {[0, 1, 2].map((i) => (
            <MiniPost
              key={i}
              index={i}
              onOpen={() => go("post")}
              onProfile={() => go("profile")}
            />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle onAll={() => go("charts")}>내 곡</SectionTitle>
        <SongRail onSelect={() => go("abyss")} />
      </section>
    </div>
  );
}
export function ChartsScreen({ go }: { go: Navigate }) {
  return (
    <div className="list-view scroll-content">
      <BackTitle title="인기차트" go={go} />
      <div className="chart-list">
        {Array.from({ length: 12 }).map((_, i) => (
          <button className="chart-row" key={i}>
            <span className="chart-art">
              <Asset
                name={postImages[(i * 5) % postImages.length]}
                alt="곡 커버"
              />
            </span>
            <span>
              <strong>Name</strong>
              <small>name</small>
            </span>
            <Asset name="option.svg" />
          </button>
        ))}
      </div>
    </div>
  );
}
export function PostsScreen({ go }: { go: Navigate }) {
  return (
    <div className="list-view scroll-content">
      <BackTitle title="인기글" go={go} />
      <div className="posts-list">
        {Array.from({ length: 8 }).map((_, i) => (
          <MiniPost
            tall
            key={i}
            index={i}
            onOpen={() => go("post")}
            onProfile={() => go("profile")}
          />
        ))}
      </div>
    </div>
  );
}
export function AbyssScreen({ go }: { go: Navigate }) {
  const [playing, setPlaying] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [saved, setSaved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  return (
    <div className="abyss-view">
      <div className="abyss-song">
        <Asset
          name="abyss-album.png"
          alt="Pretender 앨범 커버"
          className="abyss-cover"
        />
        <div className="abyss-title">
          <h1>Pretender</h1>
          <p>
            min chong <i /> <button>작곡 참여자 보기</button>
          </p>
        </div>
      </div>
      <div className="abyss-actions">
        <div className="abyss-vote">
          <button
            className={vote === "like" ? "active" : ""}
            onClick={() =>
              setVote((current) => (current === "like" ? null : "like"))
            }
            aria-label="좋아요"
            aria-pressed={vote === "like"}
          >
            <Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />
            116
          </button>
          <i />
          <button
            aria-label="싫어요"
            aria-pressed={vote === "dislike"}
            className="abyss-dislike"
            onClick={() =>
              setVote((current) => (current === "dislike" ? null : "dislike"))
            }
          >
            <Asset name={vote === "dislike" ? "like-filled.svg" : "like.svg"} />
          </button>
        </div>
        <button
          aria-label="댓글"
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen(true)}
        >
          <Asset name="comment.svg" />
          116
        </button>
        <button aria-label="공유">
          <Asset name="share.svg" />
        </button>
        <button
          aria-label="저장"
          aria-pressed={saved}
          onClick={() => setSaved((current) => !current)}
        >
          <Asset name={saved ? "bookmark-filled.svg" : "bookmark.svg"} />
        </button>
      </div>
      <div className="abyss-player">
        <button className="abyss-progress" aria-label="재생 위치">
          <i style={{ width: playing ? "38%" : "18%" }}>
            <b />
          </i>
        </button>
        <button
          className="abyss-player-controls"
          aria-label={playing ? "일시정지" : "재생"}
          onClick={() => setPlaying(!playing)}
        >
          <Asset name="abyss-player.svg" />
        </button>
      </div>
      <button className="abyss-join" onClick={() => go("studio")}>
        작곡 참여하기
      </button>
      <AbyssComments
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        go={go}
      />
    </div>
  );
}
// 소셜 페이지 "친구" 탭 본문. 프로필 이름/아바타를 누르면 프로필로 이동한다.
function FriendsSections({ go }: { go: Navigate }) {
  const [following, setFollowing] = useState([false, true, true, false]);
  const [requests, setRequests] = useState([true, true]);
  return (
    <div className="friends-view">
      <section>
        <SectionTitle>팔로우 추천</SectionTitle>
        <div className="people-list">
          {following.map((on, i) => (
            <div className="person" key={i}>
              <button className="person-link" onClick={() => go("profile")}>
                <Avatar />
                <span>
                  <strong>Muhehehe</strong>
                  <small>피아노</small>
                </span>
              </button>
              <button
                className="purple-pill"
                onClick={() =>
                  setFollowing((s) => s.map((v, x) => (x === i ? !v : v)))
                }
              >
                {on ? "맞팔로우" : "팔로우"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>팔로우 요청</SectionTitle>
        <div className="people-list">
          {requests.map(
            (show, i) =>
              show && (
                <div className="person" key={i}>
                  <button className="person-link" onClick={() => go("profile")}>
                    <Avatar />
                    <span>
                      <strong>Muhehehe</strong>
                      <small>피아노</small>
                    </span>
                  </button>
                  <button
                    className="purple-pill compact"
                    onClick={() =>
                      setRequests((s) => s.map((v, x) => (x === i ? false : v)))
                    }
                  >
                    확인
                  </button>
                  <button
                    className="gray-pill"
                    onClick={() =>
                      setRequests((s) => s.map((v, x) => (x === i ? false : v)))
                    }
                  >
                    취소
                  </button>
                </div>
              ),
          )}
        </div>
      </section>
    </div>
  );
}
export function SearchScreen({ go }: { go: Navigate }) {
  const [query, setQuery] = useState("");
  return (
    <div className="search-view">
      <div className="search-line">
        <button onClick={() => go("home")} aria-label="뒤로">
          <Asset name="return.svg" />
        </button>
        <label>
          <Asset name="search.svg" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="검색어 지우기">
              ×
            </button>
          )}
        </label>
      </div>
      {query && (
        <p className="search-result">‘{query}’ 검색 결과가 없습니다.</p>
      )}
    </div>
  );
}
function CommunityPost({
  index,
  onProfile,
}: {
  index: number;
  onProfile?: () => void;
}) {
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <article className="community-post">
      <div className="community-author">
        {/* 작성자 프로필/이름 클릭 → 그 사람 프로필로 이동 */}
        <button className="community-author-link" onClick={onProfile}>
          <Avatar />
          <strong>min chong</strong>
        </button>
        <span>• 1초 전</span>
        <Asset name="option.svg" />
      </div>
      <h2>이거 좋냐?</h2>
      <p>{sampleText}</p>
      <Asset
        name={postImages[index % postImages.length]}
        alt="게시물 이미지"
        className="community-image"
      />
      <div className="community-actions">
        <div
          className={`community-vote${vote ? " active" : ""}`}
          role="group"
          aria-label="게시글 반응"
        >
          <button
            className={vote === "like" ? "liked" : ""}
            onClick={() =>
              setVote((current) => (current === "like" ? null : "like"))
            }
            aria-label="좋아요"
            aria-pressed={vote === "like"}
          >
            <Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />
            116
          </button>
          <span className="community-vote-divider" aria-hidden="true" />
          <button
            aria-label="싫어요"
            aria-pressed={vote === "dislike"}
            onClick={() =>
              setVote((current) => (current === "dislike" ? null : "dislike"))
            }
          >
            <Asset
              name={vote === "dislike" ? "like-filled.svg" : "like.svg"}
              className="thumb-down"
            />
          </button>
        </div>
        <button>
          <Asset name="comment.svg" />
          116
        </button>
        <i />
        <button>
          <Asset name="share.svg" />
        </button>
        <button
          className={saved ? "active" : ""}
          aria-label="저장"
          aria-pressed={saved}
          onClick={() => setSaved((current) => !current)}
        >
          <Asset name={saved ? "bookmark-filled.svg" : "bookmark.svg"} />
        </button>
      </div>
    </article>
  );
}
// 가입한 커뮤니티(가로 갤러리) + 추천 커뮤니티(세로 리스트). 버튼은 토글 목업.
function CommunitiesTab() {
  const [joined, setJoined] = useState([true, true, true]);
  const [recommended, setRecommended] = useState([false, false, false]);
  return (
    <>
      <section>
        <SectionTitle onAll={() => undefined}>가입한 커뮤니티</SectionTitle>
        <div className="community-gallery">
          {joined.map((on, i) => (
            <div className="community-card" key={i}>
              <span className="community-card-art">
                <Asset name="profile.png" alt="커뮤니티" />
              </span>
              <strong>Muhehehe</strong>
              <small>가입자 100명</small>
              <button
                className="purple-pill community-join-button"
                aria-pressed={on}
                onClick={() =>
                  setJoined((s) => s.map((v, x) => (x === i ? !v : v)))
                }
              >
                {on ? "가입됨" : "가입"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>추천 커뮤니티</SectionTitle>
        <div className="community-rec-list">
          {recommended.map((on, i) => (
            <div className="community-rec" key={i}>
              <span className="community-rec-art">
                <Asset name="profile.png" alt="커뮤니티" />
              </span>
              <div className="community-rec-body">
                <strong>Muhehehe</strong>
                <small>가입자 100명</small>
                <p>
                  이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는
                  곳입니다 이곳은 Muhehe를 찬성하는 곳입니다
                </p>
              </div>
              <button
                className="purple-pill community-join-button"
                aria-pressed={on}
                onClick={() =>
                  setRecommended((s) => s.map((v, x) => (x === i ? !v : v)))
                }
              >
                {on ? "가입됨" : "가입"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
// 소셜 페이지: 게시글 / 커뮤니티 / 친구 3개 탭.
export function SocialScreen({ go }: { go: Navigate }) {
  const [tab, setTab] = useState<"posts" | "communities" | "friends">("posts");
  return (
    <div className="social-view">
      <div className="community-tabs">
        <button
          className={tab === "posts" ? "active" : ""}
          onClick={() => setTab("posts")}
        >
          게시글
        </button>
        <button
          className={tab === "communities" ? "active" : ""}
          onClick={() => setTab("communities")}
        >
          커뮤니티
        </button>
        <button
          className={tab === "friends" ? "active" : ""}
          onClick={() => setTab("friends")}
        >
          친구
        </button>
      </div>
      <div className="social-body scroll-content">
        {tab === "posts" &&
          [0, 1].map((i) => (
            <CommunityPost key={i} index={i} onProfile={() => go("profile")} />
          ))}
        {tab === "communities" && <CommunitiesTab />}
        {tab === "friends" && <FriendsSections go={go} />}
      </div>
    </div>
  );
}
// 오픈소스: 공유된 파트 카드 피드. 저장/좋아요는 토글 목업.
export function OpensourceScreen({ go }: { go: Navigate }) {
  return (
    <div className="opensource-view scroll-content">
      {[0, 1, 2, 3, 4].map((i) => (
        <OpensourcePart
          key={i}
          onOpen={() => go("opensourceDetail")}
          onProfile={() => go("profile")}
          onComments={() => go("opensourceComments")}
        />
      ))}
    </div>
  );
}
function OpensourcePart({
  onOpen,
  onProfile,
  onComments,
}: {
  onOpen?: () => void;
  onProfile?: () => void;
  onComments?: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  return (
    <article className="os-card">
      <div className="os-head">
        <button className="os-author" onClick={onOpen} aria-label="오픈소스 글 보기">
          <Avatar />
          <span>
            <strong>개쩌는 파트</strong>
            <small>사용 수 123123</small>
          </span>
        </button>
        <button
          className="purple-pill os-save-button"
          aria-pressed={saved}
          onClick={() => setSaved((v) => !v)}
        >
          {saved ? "저장됨" : "저장"}
        </button>
      </div>
      <button className="os-body" onClick={onOpen}>
        제가 만들다 보니까 쫌 개쩔게 나와서 한번 올려봅니당
      </button>
      <div className="os-foot">
        <button className="os-foot-author" onClick={onProfile}>
          <Avatar />
          <span>min chong</span>
        </button>
        <div className="os-reactions">
          <button
            className={vote === "like" ? "voted" : ""}
            aria-label="좋아요"
            aria-pressed={vote === "like"}
            onClick={() => setVote((c) => (c === "like" ? null : "like"))}
          >
            <Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />5
          </button>
          <button
            className={`os-dislike${vote === "dislike" ? " voted" : ""}`}
            aria-label="싫어요"
            aria-pressed={vote === "dislike"}
            onClick={() => setVote((c) => (c === "dislike" ? null : "dislike"))}
          >
            <Asset name={vote === "dislike" ? "like-filled.svg" : "like.svg"} />
          </button>
          <button aria-label="댓글" onClick={onComments}>
            <Asset name="comment.svg" />5
          </button>
        </div>
      </div>
    </article>
  );
}

type OsDetailCommentData = {
  id: number;
  parentId?: number;
  author: string;
  time: string;
  text: string;
  likes: number;
  vote: "like" | "dislike" | null;
};

const initialOsComments: OsDetailCommentData[] = [
  { id: 1, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
  { id: 2, parentId: 1, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
  { id: 3, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
  { id: 4, author: "min chong", time: "1초 전", text: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", likes: 116, vote: null },
];

const OS_REPLIES_PAGE = 10;

function OpensourceComment({
  comment,
  reply = false,
  canReply = true,
  menuOpen,
  onMenu,
  onReply,
  onVote,
  onReport,
}: {
  comment: OsDetailCommentData;
  reply?: boolean;
  canReply?: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onReply: () => void;
  onVote: (vote: "like" | "dislike") => void;
  onReport: () => void;
}) {
  return (
    <article className={reply ? "os-detail-comment reply" : "os-detail-comment"}>
      <div className="os-detail-comment-head">
        <Avatar />
        <span className="os-detail-comment-meta"><strong>{comment.author}</strong><small>• {comment.time}</small></span>
        <button aria-label="댓글 옵션" onClick={onMenu}><Asset name="option.svg" /></button>
        {menuOpen && <button className="os-detail-report" onClick={onReport}>신고</button>}
      </div>
      {canReply ? (
        <button className="os-detail-comment-text" onClick={onReply}>{comment.text}</button>
      ) : (
        <p className="os-detail-comment-text">{comment.text}</p>
      )}
      <div className="os-detail-comment-actions">
        {canReply && <button aria-label="답글" onClick={onReply}><Asset name="comment.svg" /></button>}
        <button
          className={comment.vote === "like" ? "active" : ""}
          aria-label="댓글 좋아요"
          aria-pressed={comment.vote === "like"}
          onClick={() => onVote("like")}
        ><Asset name={comment.vote === "like" ? "like-filled.svg" : "like.svg"} />{comment.likes}</button>
        <button
          className={comment.vote === "dislike" ? "active dislike" : "dislike"}
          aria-label="댓글 싫어요"
          aria-pressed={comment.vote === "dislike"}
          onClick={() => onVote("dislike")}
        ><Asset name={comment.vote === "dislike" ? "like-filled.svg" : "like.svg"} /></button>
      </div>
    </article>
  );
}

function OpensourceCommentThread({
  comment,
  replies,
  menuId,
  onMenu,
  onReply,
  onVote,
  onReport,
}: {
  comment: OsDetailCommentData;
  replies: OsDetailCommentData[];
  menuId: number | null;
  onMenu: (id: number) => void;
  onReply: (comment: OsDetailCommentData) => void;
  onVote: (id: number, vote: "like" | "dislike") => void;
  onReport: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [visible, setVisible] = useState(OS_REPLIES_PAGE);
  const shownReplies = replies.slice(0, visible);

  return (
    <div className="os-detail-comment-thread">
      <OpensourceComment
        comment={comment}
        menuOpen={menuId === comment.id}
        onMenu={() => onMenu(comment.id)}
        onReply={() => onReply(comment)}
        onVote={(next) => onVote(comment.id, next)}
        onReport={() => onReport(comment.id)}
      />
      {replies.length > 0 && collapsed && (
        <button
          className="abyss-replies-toggle"
          onClick={() => setCollapsed(false)}
        >
          답글 {replies.length}개
        </button>
      )}
      {replies.length > 0 && !collapsed && (
        <div className="abyss-comment-replies">
          <button
            className="abyss-replies-bar"
            aria-label="답글 접기"
            onClick={() => setCollapsed(true)}
          />
          <div className="abyss-replies-body">
            {shownReplies.map((reply) => (
              <OpensourceComment
                key={reply.id}
                comment={reply}
                reply
                canReply={false}
                menuOpen={menuId === reply.id}
                onMenu={() => onMenu(reply.id)}
                onReply={() => undefined}
                onVote={(next) => onVote(reply.id, next)}
                onReport={() => onReport(reply.id)}
              />
            ))}
            {replies.length > visible && (
              <button
                className="abyss-replies-more"
                onClick={() => setVisible((current) => current + OS_REPLIES_PAGE)}
              >
                더보기 ({replies.length - visible})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OpensourceDetailScreen({
  focusComments = false,
}: {
  focusComments?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const [comments, setComments] = useState(initialOsComments);
  const [replyTo, setReplyTo] = useState<OsDetailCommentData | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const commentsRef = useRef<HTMLElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  const focusCommentComposer = (behavior: ScrollBehavior = "smooth") => {
    setReplyTo(null);
    commentsRef.current?.scrollIntoView({ behavior, block: "start" });
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };
  useEffect(() => {
    if (!focusComments) return;
    const frame = requestAnimationFrame(() => focusCommentComposer("auto"));
    return () => cancelAnimationFrame(frame);
  }, [focusComments]);

  const toggleCommentVote = (id: number, next: "like" | "dislike") => {
    setComments((items) => items.map((comment) => {
      if (comment.id !== id) return comment;
      const vote = comment.vote === next ? null : next;
      const likes = comment.likes + (vote === "like" ? 1 : 0) - (comment.vote === "like" ? 1 : 0);
      return { ...comment, vote, likes };
    }));
  };
  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((items) => [...items, {
      id: Date.now(),
      parentId: replyTo?.parentId ?? replyTo?.id,
      author: "나",
      time: "방금",
      text,
      likes: 0,
      vote: null,
    }]);
    setDraft("");
    setReplyTo(null);
  };
  return (
    <div className="opensource-detail-shell">
      <div className="opensource-detail scroll-content">
        <section className="os-detail-article">
        <div className="os-detail-title-row">
          <div className="os-detail-title">
            <Avatar />
            <span><strong>개쩌는 파트</strong><small>사용 수 123123</small></span>
          </div>
          <button
            className="purple-pill os-save-button"
            aria-pressed={saved}
            onClick={() => setSaved((current) => !current)}
          >{saved ? "저장됨" : "저장"}</button>
        </div>
        <div className="os-detail-byline"><Avatar /><span>min chong · 2026.03.18</span></div>
        <p className="os-detail-copy">제가 만들다 보니까 쫌 개쩔게 나와서 한번 올려봅니당</p>
        <div className="os-audio-player">
          <button
            className="os-audio-play-toggle"
            aria-label={playing ? "일시정지" : "재생"}
            aria-pressed={playing}
            onClick={() => setPlaying((current) => !current)}
          >
            <Asset name="play.svg" />
            <span>{playing ? "0:01" : "0:00"} / 0:02</span>
            <i><b style={{ width: playing ? "58%" : "28%" }} /></i>
          </button>
          <button
            className="os-audio-mute"
            aria-label={muted ? "소리 켜기" : "무음"}
            aria-pressed={muted}
            title={muted ? "소리 켜기" : "소리 끄기"}
            onClick={() => setMuted((current) => !current)}
          >
            <Asset name={muted ? "sound-muted.svg" : "sound.svg"} />
          </button>
        </div>
        <div className="os-detail-reactions">
          <div className={`os-detail-vote${vote ? " active" : ""}`}>
            <button
              aria-label="좋아요"
              aria-pressed={vote === "like"}
              onClick={() => setVote((current) => current === "like" ? null : "like")}
            ><Asset name={vote === "like" ? "like-filled.svg" : "like.svg"} />116</button>
            <i />
            <button
              className="dislike"
              aria-label="싫어요"
              aria-pressed={vote === "dislike"}
              onClick={() => setVote((current) => current === "dislike" ? null : "dislike")}
            ><Asset name={vote === "dislike" ? "like-filled.svg" : "like.svg"} /></button>
          </div>
          <button className="os-detail-comment-count" onClick={() => focusCommentComposer()}><Asset name="comment.svg" />116</button>
          <span />
          <button className="os-detail-share" aria-label="공유"><Asset name="share.svg" /></button>
        </div>
        </section>
        <section ref={commentsRef} className="os-detail-comments" aria-label="댓글">
          {comments.filter((comment) => !comment.parentId).map((comment) => (
            <OpensourceCommentThread
              key={comment.id}
              comment={comment}
              replies={comments.filter((reply) => reply.parentId === comment.id)}
              menuId={menuId}
              onMenu={(id) => setMenuId((current) => current === id ? null : id)}
              onReply={(target) => {
                setReplyTo(target);
                requestAnimationFrame(() => composerInputRef.current?.focus());
              }}
              onVote={toggleCommentVote}
              onReport={(id) => {
                setComments((items) => items.filter((item) => item.id !== id && item.parentId !== id));
                setMenuId(null);
              }}
            />
          ))}
        </section>
      </div>
      <div className="os-detail-composer">
        {replyTo && (
          <div className="os-detail-replying">
            <span>{replyTo.author}에게 답글</span>
            <button aria-label="답글 취소" onClick={() => setReplyTo(null)}>×</button>
          </div>
        )}
        <div className="os-detail-composer-row">
          <Avatar />
          <input
            ref={composerInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && submitComment()}
            placeholder={replyTo ? `${replyTo.author}에게 답글 남기기` : "댓글 달기"}
          />
          <button disabled={!draft.trim()} onClick={submitComment}>게시</button>
        </div>
      </div>
    </div>
  );
}
// 인기글 상세: Figma 10637:17534의 Article 영역. 댓글 목록은 요청에 따라 제외한다.
export function PostDetailScreen({ go }: { go: Navigate }) {
  return (
    <div className="post-detail-view scroll-content">
      <CommunityPost index={0} onProfile={() => go("profile")} />
    </div>
  );
}
export function ProfileScreen({ go }: { go: Navigate }) {
  return (
    <div className="profile-view scroll-content">
      <button
        className="profile-edit-trigger"
        onClick={() => go("edit")}
        aria-label="프로필 편집"
      >
        <Avatar large />
      </button>
      <h1>oii_aio_iiiaii</h1>
      <div className="stats">
        <span>
          <strong>Follower</strong>
          <small>12k</small>
        </span>
        <span>
          <strong>Following</strong>
          <small>12k</small>
        </span>
        <span>
          <strong>Articles</strong>
          <small>12k</small>
        </span>
      </div>
      <div className="tags">
        <span>Guitar</span>
        <span>Piano</span>
        <span>Wa Sans</span>
      </div>
      <section className="description">
        <h2>Description</h2>
        <p>
          안녕하십니까 저는 지금 SO MUHEHE 합니다 하지만 모든것이 MUHEHE할순
          없겠죠
          <br />
          hahahahahahahadfsgdsfsfsadfasdfdsafasdfasdfdsafdas
        </p>
      </section>
      <section>
        <SectionTitle>내 작업물</SectionTitle>
        <SongRail />
      </section>
    </div>
  );
}
export function EditProfileScreen() {
  return (
    <div className="edit-view scroll-content">
      <button className="edit-avatar" aria-label="프로필 사진 변경">
        <Avatar large />
        <span>
          <Asset name="photo-add.svg" />
        </span>
      </button>
      <label>
        <strong>이름</strong>
        <input defaultValue="oii_aio_iiiaii" />
      </label>
      <label>
        <strong>악기</strong>
        <input defaultValue="Guitar, Piano, Wa Sans" />
      </label>
      <label>
        <strong>설명</strong>
        <textarea
          defaultValue={
            "안녕하십니까 저는 지금 SO MUHEHE 합니다 하지만 모든것이 MUHEHE할순 없겠죠\nhahahahahahahadfsgdsfsfsadfasdfdsafasdfasdfdsafdas"
          }
        />
      </label>
    </div>
  );
}
