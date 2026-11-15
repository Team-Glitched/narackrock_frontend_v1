export function PostCommunityLabel({ name }: { name?: string | null }) {
  const label = name?.trim();
  if (!label) return null;

  return (
    <span
      className="block w-fit max-w-full shrink-0 truncate rounded-full bg-app-surface px-2.5 py-1 text-caption leading-[18px] font-medium text-app-fg"
      title={label}
    >
      <span className="sr-only">커뮤니티 </span>
      {label}
    </span>
  );
}
