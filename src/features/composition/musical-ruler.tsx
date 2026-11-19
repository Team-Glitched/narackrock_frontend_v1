import { studioStyles } from "@/styles/studio.styles";
import { musicalGridBackground, rulerLabels, type TimeSignature } from "./time-signature";

export type RulerTickWindow = {
  ppq: number;
  startTick: number;
  endTick: number;
  pixelsPerTick: number;
  originTick?: number;
};

export function MusicalRuler({ signature, width, tickWindow }: {
  signature: TimeSignature;
  width: number;
  tickWindow?: RulerTickWindow;
}) {
  if (tickWindow) {
    const { ppq, startTick, endTick, pixelsPerTick, originTick = 0 } = tickWindow;
    const beatTicks = ppq * 4 / signature.denominator;
    if (!(beatTicks > 0) || !(pixelsPerTick > 0) || endTick <= startTick) return null;
    const firstBeat = Math.ceil((startTick + originTick) / beatTicks - 1e-9);
    const lastBeat = Math.floor((endTick + originTick) / beatTicks + 1e-9);
    return (
      <div
        className={studioStyles.musicalRulerMarks}
        aria-hidden="true"
        style={{ left: startTick * pixelsPerTick, width: (endTick - startTick) * pixelsPerTick, backgroundImage: "none" }}
      >
        {Array.from({ length: Math.max(0, lastBeat - firstBeat + 1) }, (_, offset) => {
          const beat = firstBeat + offset;
          const bar = beat % signature.numerator === 0;
          return (
            <span
              key={beat}
              style={{
                left: (beat * beatTicks - startTick - originTick) * pixelsPerTick,
                height: bar ? "100%" : "40%",
                top: bar ? 0 : "60%",
                borderLeft: `1px solid ${bar ? "var(--grid-bar)" : "var(--grid-beat)"}`,
                paddingLeft: 3,
              }}
            >
              {bar ? Math.floor(beat / signature.numerator) + 1 : ""}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div
      className={studioStyles.musicalRulerMarks}
      aria-hidden="true"
      style={{
        backgroundImage: musicalGridBackground(signature, {
          bar: "var(--muted)", beat: "var(--grid-bar)", cell: "var(--grid-beat)",
        }),
      }}
    >
      {rulerLabels(signature, width).map((label) => (
        <span key={label.bar} style={{ left: label.left }}>{label.bar}</span>
      ))}
    </div>
  );
}
