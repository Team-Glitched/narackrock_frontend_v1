export function PostCommunityLabel({ name }: { name?: string | null }) {
  const label = name?.trim();
  if (!label) return null;

  return (
    <span
      className="my-1 block w-fit max-w-full truncate rounded-full bg-app-surface px-2 py-0.5 text-caption font-medium text-app-fg"
      title={label}
    >
      <span className="sr-only">커뮤니티 </span>
      {label}
    </span>
  );
}
