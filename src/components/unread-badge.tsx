export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-[#18181c]"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
