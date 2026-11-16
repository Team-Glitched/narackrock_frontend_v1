import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import type { DrumIconKind } from "../../../src/features/composition/drum-kit";

/** The web's DrumPadIcon (drum-pad-icon.tsx): a line drawing per pad of the basic kit. */
export function DrumPadIcon({ kind, color, size = 24 }: { kind: DrumIconKind; color: string; size?: number }) {
  const cymbal = kind.startsWith("crash") || kind.startsWith("ride");
  const tom = kind.startsWith("tom");
  return (
    <Svg
      viewBox="0 0 40 36"
      width={(size * 26) / 24}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {cymbal && (
        <>
          <G
            rotation={kind === "crash-left" ? -12 : kind === "crash-right" ? 12 : 0}
            origin="20, 12"
          >
            <Ellipse cx="20" cy="12" rx="15" ry="5" />
            <Path d="M16 11q4-10 8 0M7 12q13 5 26 0" />
            {kind === "ride-bell" && <Circle cx="20" cy="6" r="2.5" fill={color} />}
            {kind === "ride-bow" && <Circle cx="30" cy="13" r="2.5" fill={color} />}
          </G>
          <Path d="M20 17v12m0-4-7 8m7-8 7 8" />
          {kind === "crash-left" && <Path d="m7 5-3-2m9 1-1-3" />}
          {kind === "crash-right" && <Path d="m33 5 3-2m-9 1 1-3" />}
        </>
      )}
      {tom && (
        <>
          <Ellipse
            cx="20"
            cy="10"
            rx={kind === "tom-high" ? 10 : kind === "tom-mid" ? 12 : 14}
            ry="5"
          />
          <Path
            d={
              kind === "tom-high"
                ? "M10 10v12c0 6 20 6 20 0V10M14 14v9m12-9v9"
                : kind === "tom-mid"
                  ? "M8 10v14c0 7 24 7 24 0V10M13 14v11m14-11v11"
                  : "M6 10v15c0 7 28 7 28 0V10M11 14v11m18-11v11M10 28l-2 6m24-6 2 6"
            }
          />
        </>
      )}
      {kind === "snare" && (
        <>
          <Ellipse cx="20" cy="10" rx="14" ry="5" />
          <Path d="M6 10v13c0 7 28 7 28 0V10M11 14v9m18-9v9M7 20h26M13 28l3 4m2-4 3 4m2-4 3 4" />
        </>
      )}
      {(kind === "hihat-open" || kind === "hihat-closed") && (
        <>
          <Ellipse cx="20" cy={kind === "hihat-open" ? 8 : 11} rx="14" ry="4" />
          <Ellipse cx="20" cy={kind === "hihat-open" ? 18 : 15} rx="14" ry="4" />
          <Path d="M20 3v3m0 16v9m0-3-7 6m7-6 7 6" />
          {kind === "hihat-open" && <Path d="M35 10v6" />}
        </>
      )}
      {kind === "kick" && (
        <>
          <Ellipse cx="17" cy="17" rx="12" ry="13" />
          <Path d="M17 4h7c16 0 16 26 0 26h-7M8 27l-3 6m21-5 5 5M16 24v10h9l-4-5h-5" />
          <Circle cx="17" cy="17" r="5" />
        </>
      )}
      {kind === "percussion" && (
        <>
          <Circle cx="20" cy="18" r="12" />
          <Circle cx="20" cy="18" r="7" />
          <Path d="m6 4 11 11m17-11L23 15M7 26l-3 4m29-4 3 4" />
        </>
      )}
    </Svg>
  );
}
