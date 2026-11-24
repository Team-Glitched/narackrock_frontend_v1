/** Full-height rewind-to-start icon matching play.svg and return.svg visual scale. */
export function RewindIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="1.5" y="1" width="3" height="18" rx="1.5" fill="#F2F4F6" />
      <path
        d="M18 2.25L7.5 10L18 17.75V2.25Z"
        fill="#F2F4F6"
        stroke="#F2F4F6"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
