import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants } from "@/styles/variants";
import { profileStyles } from "@/styles/profile.styles";
import { useState } from "react";
import { Avatar, SectionTitle } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";

export function FriendsScreen({ go }: { go: Navigate }) {
  const [following, setFollowing] = useState([false, true, true, false]);
  const [requests, setRequests] = useState([true, true]);
  return (
    <div className={cn(socialStyles.friendsView, sharedStyles.scrollContent)}>
      <section className={"mutual-friends"}>
        <SectionTitle>맞팔로우</SectionTitle>
        <div className={socialStyles.mutualFriendRail}>
          {[0, 1, 2, 3].map((id) => (
            <article className={socialStyles.mutualFriendCard} key={id}>
              <button
                className={socialStyles.mutualFriendIdentity}
                aria-label="Muhehehe 프로필"
                onClick={() => go("profile", 3)}
              >
                <Avatar />
                <strong>Muhehehe</strong>
                <small>피아노</small>
              </button>
              <button
                className={buttonVariants({
                  tone: "primary",
                })}
                onClick={() => go("chat")}
              >
                채팅
              </button>
            </article>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>팔로우 추천</SectionTitle>
        <div className={profileStyles.peopleList}>
          {following.map((on, i) => (
            <div className={socialStyles.person} key={i}>
              <button className={socialStyles.personLink} onClick={() => go("profile", 3)}>
                <Avatar />
                <span>
                  <strong>Muhehehe</strong>
                  <small>피아노</small>
                </span>
              </button>
              <button
                className={buttonVariants({
                  tone: "primary",
                })}
                onClick={() => setFollowing((s) => s.map((v, x) => (x === i ? !v : v)))}
              >
                {on ? "맞팔로우" : "팔로우"}
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>팔로우 요청</SectionTitle>
        <div className={profileStyles.peopleList}>
          {requests.map(
            (show, i) =>
              show && (
                <div className={socialStyles.person} key={i}>
                  <button className={socialStyles.personLink} onClick={() => go("profile", 3)}>
                    <Avatar />
                    <span>
                      <strong>Muhehehe</strong>
                      <small>피아노</small>
                    </span>
                  </button>
                  <button
                    className={buttonVariants({
                      tone: "primary",
                      size: "compact",
                    })}
                    onClick={() => setRequests((s) => s.map((v, x) => (x === i ? false : v)))}
                  >
                    확인
                  </button>
                  <button
                    className={buttonVariants({
                      tone: "secondary",
                    })}
                    onClick={() => setRequests((s) => s.map((v, x) => (x === i ? false : v)))}
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
