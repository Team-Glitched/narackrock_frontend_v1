import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { usePortalHost } from "./use-portal-host";
import { SharkBandLoader } from "./shark-band-loader";
import { DEFAULT_LOADING_DELAY_MS, type SharkMember } from "./shark-member";

export type LoadingOverlayProps = {
  message?: string;
  submessage?: string;
  /** Wait before showing so short loads never flash (ms). Default 1000ms. */
  delayMs?: number;
  /** Fix which shark member renders instead of choosing one at random. */
  member?: SharkMember;
  /** Portal into `.design-canvas` when present (default true); falls back to fixed full-viewport. */
  portal?: boolean;
  className?: string;
};

/**
 * Full-screen semi-transparent loading overlay featuring one animated shark member on slow loads.
 */
export function LoadingOverlay(props: LoadingOverlayProps) {
  const { delayMs = DEFAULT_LOADING_DELAY_MS } = props;
  return <LoadingOverlayContent key={delayMs} {...props} delayMs={delayMs} />;
}

function LoadingOverlayContent({
  message = "불러오는 중입니다.",
  submessage,
  delayMs,
  member,
  portal = true,
  className,
}: LoadingOverlayProps & { delayMs: number }) {
  const host = usePortalHost(".design-canvas");
  const [delayedReady, setDelayedReady] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => setDelayedReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  const visible = delayMs <= 0 || delayedReady;
  if (!visible) return null;

  const targetHost = portal ? host : null;
  const overlay = (
    <div
      className={cn(
        targetHost ? "absolute inset-0 z-[120]" : "fixed inset-0 z-[120]",
        "shark-loading-overlay flex select-none items-center justify-center bg-black/75 px-5 backdrop-blur-[2px]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex w-full max-w-[320px] flex-col items-center justify-center gap-3 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[42%] h-[210px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 50% 56%, rgba(124, 77, 255, 0.24) 0%, rgba(255, 255, 255, 0.06) 44%, transparent 72%)",
          }}
        />
        <SharkBandLoader member={member} />
        <div className="relative z-[1] flex flex-col items-center gap-1">
          <p className="m-0 text-label font-semibold leading-[22px] tracking-[-0.01em] text-white">
            {message}
          </p>
          {submessage && (
            <p className="m-0 text-caption leading-[18px] text-white/70">{submessage}</p>
          )}
        </div>
      </div>
    </div>
  );

  return targetHost ? createPortal(overlay, targetHost) : overlay;
}
