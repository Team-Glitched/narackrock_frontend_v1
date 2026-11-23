import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";

const avatarSizeClasses = {
  xs: "size-4",
  sm: "size-6",
  md: "size-8",
  lg: "size-[140px]",
} as const;

export function Avatar({
  large = false,
  size,
  src = null,
  className,
}: {
  large?: boolean;
  size?: keyof typeof avatarSizeClasses;
  src?: string | null;
  className?: string;
}) {
  const resolvedSize = large ? "lg" : (size ?? "md");
  return (
    <span
      className={cn(
        sharedStyles.avatar,
        "block flex-none overflow-hidden rounded-full bg-[#555] [&>img]:size-full [&>img]:object-cover",
        avatarSizeClasses[resolvedSize],
        large && sharedStyles.avatarLarge,
        className,
      )}
    >
      {src ? (
        <img src={src} alt="프로필" draggable={false} />
      ) : (
        <span
          role="img"
          aria-label="프로필"
          className="grid size-full place-items-center bg-[#949494] text-white"
        >
          <UserRound aria-hidden="true" className="size-[58%]" />
        </span>
      )}
    </span>
  );
}
