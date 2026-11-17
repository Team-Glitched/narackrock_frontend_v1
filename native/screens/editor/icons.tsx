import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { colors } from "../../ui/theme";

/** The lucide icons of the web's note editor controls (ISC), as react-native-svg nodes. */
type Node =
  | ["path", string]
  | ["rect", { x: number; y: number; width: number; height: number; rx: number }]
  | ["circle", { cx: number; cy: number; r: number }]
  | ["ellipse", { cx: number; cy: number; rx: number; ry: number }];

const copyNodes: Node[] = [
  ["rect", { x: 8, y: 8, width: 14, height: 14, rx: 2 }],
  ["path", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
];

const icons = {
  pencil: [
    ["path", "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"],
    ["path", "m15 5 4 4"],
  ],
  select: [
    ["path", "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"],
    ["path", "M5 3a2 2 0 0 0-2 2M19 3a2 2 0 0 1 2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h2M14 3h1M3 9v1M21 9v2M3 14v1"],
  ],
  eraser: [
    ["path", "M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"],
    ["path", "m5.082 11.09 8.828 8.828"],
  ],
  hand: [
    ["path", "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"],
    ["path", "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"],
  ],
  undo: [["path", "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"]],
  redo: [["path", "m15 14 5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"]],
  magnet: [
    ["path", "m12 15 4 4m-11-11 4 4"],
    ["path", "M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"],
  ],
  left: [["path", "m15 18-6-6 6-6"]],
  right: [["path", "m9 18 6-6-6-6"]],
  checks: [["path", "M13 5h8M13 12h8M13 19h8m-18-2 2 2 4-4M3 7l2 2 4-4"]],
  x: [["path", "M18 6 6 18M6 6l12 12"]],
  copy: copyNodes,
  paste: [
    ["path", "M11 14h10M16 4h2a2 2 0 0 1 2 2v1.344m-3 10.656 4-4-4-4M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"],
    ["rect", { x: 8, y: 2, width: 8, height: 4, rx: 1 }],
  ],
  duplicate: [["path", "M15 12v6M12 15h6"], ...copyNodes],
  trash: [["path", "M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]],
  sliders: [["path", "M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3"]],
  drum: [
    ["path", "m2 2 8 8m12-8-8 8M7 13.4v7.9M12 14v8M17 13.4v7.9M2 9v8a10 5 0 0 0 20 0V9"],
    ["ellipse", { cx: 12, cy: 9, rx: 10, ry: 5 }],
  ],
  music: [
    ["path", "M9 18V5l12-2v13"],
    ["circle", { cx: 6, cy: 18, r: 3 }],
    ["circle", { cx: 18, cy: 16, r: 3 }],
  ],
  landscape: [
    ["path", "M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8M10 19v-3.96 3.15M7 19h5"],
    ["rect", { x: 16, y: 12, width: 6, height: 10, rx: 2 }],
  ],
  portrait: [
    ["rect", { x: 5, y: 2, width: 14, height: 20, rx: 2 }],
    ["path", "M12 18h.01"],
  ],
} satisfies Record<string, Node[]>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  size = 16,
  color = colors.fg,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(icons[name] as Node[]).map((node, index) =>
        node[0] === "path" ? (
          <Path key={index} d={node[1]} />
        ) : node[0] === "rect" ? (
          <Rect key={index} {...node[1]} />
        ) : node[0] === "circle" ? (
          <Circle key={index} {...node[1]} />
        ) : (
          <Ellipse key={index} {...node[1]} />
        ),
      )}
    </Svg>
  );
}
