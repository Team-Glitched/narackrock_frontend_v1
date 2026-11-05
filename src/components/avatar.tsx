import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { Asset } from "./asset";
export function Avatar({
  large = false,
  src = null,
  className,
}: {
  large?: boolean;
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        cn(
          sharedStyles.avatar,
          "block size-[30px] flex-none overflow-hidden rounded-full border border-solid border-app-fg bg-[#555] [&>img]:size-full [&>img]:object-cover",
        ),
        large && cn(sharedStyles.avatarLarge, "size-[140px] border-2"),
        className,
      )}
    >
      {src ? (
        <img src={src} alt="프로필" draggable={false} />
      ) : (
        <Asset name="profile.png" alt="프로필" />
      )}
    </span>
  );
}
