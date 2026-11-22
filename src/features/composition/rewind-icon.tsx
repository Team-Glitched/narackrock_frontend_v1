/** Bold rewind-to-start icon matching play.svg's visual weight. */
export function RewindIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="4.5" y="4.5" width="3" height="15" rx="1.5" fill="#F2F4F6" />
      <path
        d="M18.5 5.75L9.75 12L18.5 18.25V5.75Z"
        fill="#F2F4F6"
        stroke="#F2F4F6"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
