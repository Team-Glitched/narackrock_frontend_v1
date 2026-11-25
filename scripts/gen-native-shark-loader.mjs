// Generates native/ui/shark-band-loader-parts.ts, the app's copy of the web shark-band loader, from
// src/components/shark-band-loader.tsx (Figma layer tree) and shark-band-loader.css (keyframes).
// Run `npm run native:gen-shark-loader` after changing either web source.
//
// Each member's absolutely positioned Figma boxes become { x, y, w, h } boxes in parent-box px; the
// Tailwind rotate/scale/skew/matrix classes are folded into one matrix per box and decomposed into
// React Native transforms around the box centre (RN's transform origin). Each `data-motion-for` box
// gets its CSS keyframe tracks resolved to box-local translate (px) and rotate (deg) points, with
// cubic-bezier(0.5, 0, 0.5, 1) segments sampled into linear steps for `Animated.interpolate`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const SRC = root("src/components/shark-band-loader.tsx");
const CSS = root("src/components/shark-band-loader.css");
const OUT = root("native/ui/shark-band-loader-parts.ts");

const src = readFileSync(SRC, "utf8");
const css = readFileSync(CSS, "utf8");

/** Figma layer name -> asset file stem, from the web's `?raw` imports. */
const imports = Object.fromEntries(
  [...src.matchAll(/import raw(\w+) from "@\/assets\/loading-band\/(\w+)\.svg\?raw";/g)].map(
    (m) => [m[1], m[2]],
  ),
);

const MEMBERS = {
  DrummerShark: "drummer",
  KeyboardShark: "keyboard",
  VocalShark: "vocal",
  BassShark: "bass",
  GuitarShark: "guitar",
};

// ---- JSX -> element tree

const TAG = /<(\/?)(div|img)\b((?:[^>"{}]|"[^"]*"|\{[^}]*\})*?)(\/?)>/g;

function parse(body) {
  const top = { tag: "root", attrs: {}, kids: [] };
  const stack = [top];
  for (const [, close, tag, attrs, selfClose] of body.matchAll(TAG)) {
    if (close) {
      stack.pop();
      continue;
    }
    const a = {};
    for (const [, k, v] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) a[k] = v;
    const svg = /src=\{img(\w+)\}/.exec(attrs);
    if (svg) a.svg = svg[1];
    const node = { tag, attrs: a, kids: [] };
    stack.at(-1).kids.push(node);
    if (!selfClose && tag !== "img") stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`unbalanced JSX (${stack.length})`);
  return top.kids[0];
}

// ---- numbers and 2D matrices (a, b, c, d, e, f as in CSS matrix())

const px = (v) => parseFloat(v.trim().replace(/px$/, ""));
const radians = (deg) => deg * (Math.PI / 180);
const degrees = (rad) => rad * (180 / Math.PI);

function matMul([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) {
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

const IDENTITY = [1, 0, 0, 1, 0, 0];
const rot = (deg) => {
  const r = radians(deg);
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};

/** Fixed-point with trailing zeros dropped, the way the generated file prints every number. */
function num(v, digits = 3) {
  let t = v.toFixed(digits);
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  return t === "-0" || t === "" ? "0" : t;
}

// ---- Tailwind classes -> box props

const KNOWN = new Set([
  "absolute",
  "relative",
  "flex",
  "flex-none",
  "items-center",
  "justify-center",
  "overflow-visible",
  "pointer-events-none",
  "block",
  "max-w-none",
  "contents",
]);

function classes(el) {
  const cls = (el.attrs.className ?? "").split(/\s+/).filter(Boolean);
  const p = { set: new Set() };
  let rotate = null;
  let flipY = false;
  let tf = null;
  for (const c of cls) {
    let m = /^(-?)(h|w|size|left|top)-\[(.+)\]$/.exec(c);
    if (m && !m[1]) {
      const [, , key, val] = m;
      if (key === "left" && val.startsWith("calc(50%+")) p.leftCalc = px(val.slice(9, -1));
      else if (key === "size") p.w = p.h = px(val);
      else p[key] = px(val);
      continue;
    }
    if (c === "left-0" || c === "top-0") {
      p[c.slice(0, -2)] = 0;
      continue;
    }
    if (c === "size-full") {
      p.full = true;
      continue;
    }
    if (c === "inset-0") {
      p.inset = [0, 0, 0, 0];
      continue;
    }
    if ((m = /^inset-\[(.+)\]$/.exec(c))) {
      p.inset = m[1].split("_").map((x) => parseFloat(x.replace(/%+$/, "")) / 100);
      continue;
    }
    if (c === "-translate-x-1/2") {
      p.txHalf = true;
      continue;
    }
    if ((m = /^bg-\[(#[0-9a-fA-F]+)\]$/.exec(c))) {
      p.bg = m[1];
      continue;
    }
    if (c === "bg-white") {
      p.bg = "#ffffff";
      continue;
    }
    if ((m = /^rounded-\[(.+)px\]$/.exec(c))) {
      p.r = parseFloat(m[1]);
      continue;
    }
    if ((m = /^rotate-\[(-?[\d.]+)deg\]$/.exec(c) ?? /^rotate-(\d+)$/.exec(c))) {
      rotate = parseFloat(m[1]);
      continue;
    }
    if (c === "-scale-y-100") {
      flipY = true;
      continue;
    }
    if ((m = /^skew-x-\[(-?[\d.]+)deg\]$/.exec(c))) {
      tf = [1, 0, Math.tan(radians(parseFloat(m[1]))), 1, 0, 0];
      continue;
    }
    if ((m = /^transform-\[matrix\((.+)\)\]$/.exec(c))) {
      tf = m[1].split(",_").map(Number);
      continue;
    }
    if (c === "origin-[0_0]") {
      p.originTL = true;
      continue;
    }
    if (KNOWN.has(c)) {
      p.set.add(c);
      continue;
    }
    throw new Error(`unknown class ${c}`);
  }
  // CSS applies the individual properties in this order: translate, rotate, scale, transform.
  let lin = IDENTITY;
  if (rotate !== null) lin = matMul(lin, rot(rotate));
  if (flipY) lin = matMul(lin, [1, 0, 0, -1, 0, 0]);
  if (tf) lin = matMul(lin, tf);
  p.mat = lin.every((v, i) => v === IDENTITY[i]) ? null : lin;
  return p;
}

/** Splits a matrix into RN transforms around the box centre (CSS origin: centre, or 0 0). */
function decompose([a, b, c, d, e, f], w, h, originTL) {
  if (originTL) {
    const cx = w / 2;
    const cy = h / 2;
    [e, f] = [a * cx + c * cy + e - cx, b * cx + d * cy + f - cy];
  }
  const theta = Math.atan2(b, a);
  const sx = Math.hypot(a, b);
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const sy = -c * sn + d * cs;
  const tanPhi = (c * cs + d * sn) / sy;
  const ops = [];
  if (Math.abs(e) > 1e-4) ops.push(["translateX", num(e, 3)]);
  if (Math.abs(f) > 1e-4) ops.push(["translateY", num(f, 3)]);
  const deg = degrees(theta);
  if (Math.abs(deg) > 1e-4) ops.push(["rotate", num(deg, 4)]);
  const phi = degrees(Math.atan(tanPhi));
  if (Math.abs(phi) > 1e-4) ops.push(["skewX", num(phi, 4)]);
  if (Math.abs(sx - 1) > 1e-4) ops.push(["scaleX", num(sx, 5)]);
  if (Math.abs(sy - 1) > 1e-4) ops.push(["scaleY", num(sy, 5)]);
  return ops;
}

const motionIds = new Set();

/** Converts an element to boxes positioned in its parent box (pw x ph). */
function convert(el, pw, ph, parentFlex) {
  if (el.tag === "img") return [{ svg: el.attrs.svg }];
  const p = classes(el);
  const s = p.set;
  if (s.has("contents")) return el.kids.flatMap((k) => convert(k, pw, ph, false));
  let x;
  let y;
  let w;
  let h;
  if (p.inset) {
    const [t, r, b, l] = p.inset;
    [x, y, w, h] = [l * pw, t * ph, pw * (1 - l - r), ph * (1 - t - b)];
  } else {
    if (p.full) [w, h] = [pw, ph];
    else [w, h] = [p.w, p.h];
    if (w === undefined || h === undefined) {
      // A flex-none wrapper is sized by its single in-flow child.
      if (el.kids.length !== 1) throw new Error("unsized box with several children");
      const cp = classes(el.kids[0]);
      [w, h] = [cp.w, cp.h];
    }
    if (s.has("absolute")) {
      x = p.left ?? 0;
      y = p.top ?? 0;
      if (p.leftCalc !== undefined) x = pw / 2 + p.leftCalc;
      if (p.txHalf) x -= w / 2;
    } else if (parentFlex) {
      [x, y] = [(pw - w) / 2, (ph - h) / 2];
    } else {
      [x, y] = [0, 0];
    }
  }
  const node = { x, y, w, h };
  if (p.mat) node.tf = decompose(p.mat, w, h, p.originTL);
  if (p.bg !== undefined) node.bg = p.bg;
  if (p.r !== undefined) node.r = p.r;
  const motion = el.attrs["data-motion-for"];
  if (motion) {
    node.m = motion;
    motionIds.add(motion);
  }
  const flex = s.has("flex") && s.has("items-center");
  const kids = el.kids.flatMap((k) => convert(k, w, h, flex));
  if (kids.length) node.c = kids;
  return [node];
}

const isSvg = (n) => "svg" in n;
const isPlain = (n) => !isSvg(n) && !["tf", "bg", "r", "m"].some((k) => k in n);

/** Folds wrapper boxes that only offset or exactly cover their single child. */
function simplify(nodes) {
  const out = [];
  for (const n of nodes) {
    if (isSvg(n)) {
      out.push(n);
      continue;
    }
    n.c = simplify(n.c ?? []);
    if (isPlain(n) && n.c.length === 1 && !isSvg(n.c[0])) {
      const ch = n.c[0];
      ch.x += n.x;
      ch.y += n.y;
      out.push(ch);
      continue;
    }
    for (;;) {
      const ch = n.c.length === 1 ? n.c[0] : null;
      if (
        !ch ||
        isSvg(ch) ||
        "tf" in ch ||
        Math.abs(ch.x) >= 1e-6 ||
        Math.abs(ch.y) >= 1e-6 ||
        Math.abs(ch.w - n.w) >= 1e-3 ||
        Math.abs(ch.h - n.h) >= 1e-3 ||
        ("m" in n && "m" in ch) ||
        ("bg" in n && "bg" in ch) ||
        ("m" in n && ch.tf?.length)
      )
        break;
      for (const k of ["bg", "r", "m"]) if (k in ch) n[k] = ch[k];
      n.c = ch.c ?? [];
    }
    if (!n.c.length) delete n.c;
    out.push(n);
  }
  return out;
}

// ---- keyframes

const EASE = [0.5, 0, 0.5, 1];
const bez = (t, p1, p2) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3;

function easeY(x) {
  const [x1, y1, x2, y2] = EASE;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bez(mid, x1, x2) < x) lo = mid;
    else hi = mid;
  }
  return bez((lo + hi) / 2, y1, y2);
}

const blocks = {};
for (const [, id, body] of css.matchAll(
  /\.shark-band-loader \[data-motion-for="([\d:]+)"\] \{([\s\S]*?)\n\}/g,
)) {
  const vars = {};
  for (const [, k, v] of body.matchAll(/--motion-([\w-]+): (-?[\d.]+);/g)) vars[k] = parseFloat(v);
  const matrix = (re) => re.exec(body)[1].split(",").slice(0, 4).map(Number);
  const anim = /animation: ([^;]*);/.exec(body);
  blocks[id] = {
    vars,
    inv: matrix(/--motion-design-transform-inverse, matrix\(([^)]*)\)/),
    d: matrix(/--motion-design-transform, matrix\(([^)]*)\)/),
    anims: anim ? anim[1].split(",").map((a) => a.trim().split(/\s+/)[0]) : [],
  };
}

const keyframes = {};
for (const [, name, body] of css.matchAll(/^@keyframes (kf_\S+) \{(.*)\}\s*$/gm)) {
  keyframes[name] = [...body.matchAll(/([\d.]+)% \{([^}]*)\}/g)].map(([, pct, inner]) => {
    const eased = inner.includes("cubic-bezier(0.5, 0, 0.5, 1)");
    if (!eased && inner.includes("timing")) throw new Error(`unsupported easing: ${inner}`);
    const value = parseFloat(/--motion-[\w-]+: (-?[\d.]+);/.exec(inner)[1]);
    return [parseFloat(pct) / 100, value, eased];
  });
}

const SAMPLES = 12;

/** Piecewise-linear [t, v] points approximating a CSS keyframe track. */
function track(frames, fallback) {
  if (!frames.length) {
    return [
      [0, fallback],
      [1, fallback],
    ];
  }
  if (frames[0][0] > 0) frames = [[0, fallback, false], ...frames];
  if (frames.at(-1)[0] < 1) frames = [...frames, [1, fallback, false]];
  const pts = [];
  frames.forEach(([t, v, eased], i) => {
    pts.push([t, v]);
    if (i + 1 < frames.length && eased) {
      const [t2, v2] = frames[i + 1];
      for (let j = 1; j < SAMPLES; j++) {
        const u = j / SAMPLES;
        pts.push([t + (t2 - t) * u, v + (v2 - v) * easeY(u)]);
      }
    }
  });
  return pts;
}

function at(pts, t) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [t1, v1] = pts[i];
    const [t2, v2] = pts[i + 1];
    if (t1 <= t && t <= t2) return t2 === t1 ? v1 : v1 + ((v2 - v1) * (t - t1)) / (t2 - t1);
  }
  return pts.at(-1)[1];
}

const isConst = (pts) => pts.every(([, v]) => Math.abs(v - pts[0][1]) < 1e-6);

// ---- build

const members = {};
const usedSvgs = [];
const collect = (nodes) => {
  for (const n of nodes) {
    if (isSvg(n)) {
      if (!usedSvgs.includes(n.svg)) usedSvgs.push(n.svg);
    } else collect(n.c ?? []);
  }
};
for (const [fn, id] of Object.entries(MEMBERS)) {
  const start = src.indexOf(`function ${fn}()`);
  const end = src.indexOf("\n}\n", start);
  const tree = parse(src.slice(start, end));
  const rp = classes(tree);
  members[id] = simplify(tree.kids.flatMap((k) => convert(k, rp.w, rp.h, false)));
  collect(members[id]);
}

const motions = {};
for (const id of [...motionIds].sort()) {
  const b = blocks[id];
  if (!b) continue;
  const tr = {};
  for (const v of ["rotate", "translate-x", "translate-y"]) {
    const name = b.anims.find((n) => n.includes(`--motion-${v}_`));
    tr[v] = track(name ? keyframes[name] : [], b.vars[v] ?? 0);
  }
  const [a, bb, c, d] = b.inv;
  const [da, db, dc, dd] = b.d;
  const flip = da * dd - db * dc < 0;
  const times = [...new Set([...tr["translate-x"], ...tr["translate-y"]].map(([t]) => t))].sort(
    (p, q) => p - q,
  );
  const X = times.map((t) => [t, a * at(tr["translate-x"], t) + c * at(tr["translate-y"], t)]);
  const Y = times.map((t) => [t, bb * at(tr["translate-x"], t) + d * at(tr["translate-y"], t)]);
  const R = tr.rotate.map(([t, v]) => [t, degrees(flip ? -v : v)]);
  const entry = {};
  for (const [key, pts] of [
    ["x", X],
    ["y", Y],
    ["r", R],
  ]) {
    if (isConst(pts) && Math.abs(pts[0][1]) < 1e-6) continue;
    const clean = [];
    for (const [t, v] of pts) {
      const last = clean.at(-1);
      if (last && Math.abs(last[0] - t) < 1e-9 && Math.abs(last[1] - v) < 1e-9) continue;
      clean.push([t, v]);
    }
    entry[key] = clean;
  }
  if (Object.keys(entry).length) motions[id] = entry;
}

// ---- print (prettier-compatible, printWidth 100)

const fieldLines = (fields, pad) => fields.map((f) => `${pad}  ${f},\n`).join("");

function fmtNode(n, ind) {
  const pad = "  ".repeat(ind);
  if (isSvg(n)) return `${pad}{ s: ${n.svg} },`;
  const fields = [`x: ${num(n.x)}`, `y: ${num(n.y)}`, `w: ${num(n.w)}`, `h: ${num(n.h)}`];
  if ("tf" in n) {
    const ops = n.tf.map(([k, v]) => `{ ${k}: ${v} }`);
    let t = `t: [${ops.join(", ")}]`;
    if (pad.length + 2 + t.length + 1 > 100) {
      t = `t: [\n${ops.map((o) => `${pad}    ${o},\n`).join("")}${pad}  ]`;
    }
    fields.push(t);
  }
  if ("bg" in n) fields.push(`bg: "${n.bg.toLowerCase()}"`);
  if ("r" in n) fields.push(`r: ${num(n.r)}`);
  if ("m" in n && n.m in motions) fields.push(`m: "${n.m}"`);
  const head = fields.join(", ");
  const kids = n.c;
  if (!kids?.length) {
    const line = `${pad}{ ${head} },`;
    if (line.length <= 100) return line;
    return `${pad}{\n${fieldLines(fields, pad)}${pad}},`;
  }
  if (kids.length === 1 && isSvg(kids[0])) {
    const line = `${pad}{ ${head}, c: [{ s: ${kids[0].svg} }] },`;
    if (line.length <= 100) return line;
    return `${pad}{\n${fieldLines(fields, pad)}${pad}  c: [{ s: ${kids[0].svg} }],\n${pad}},`;
  }
  if (kids.length === 1) {
    const inner = fmtNode(kids[0], 0);
    if (!inner.includes("\n")) {
      const line = `${pad}  c: [${inner.slice(0, -1)}],`;
      if (line.length <= 100) return `${pad}{\n${fieldLines(fields, pad)}${line}\n${pad}},`;
    }
  }
  const body = kids.map((k) => fmtNode(k, ind + 2)).join("\n");
  return `${pad}{\n${fieldLines(fields, pad)}${pad}  c: [\n${body}\n${pad}  ],\n${pad}},`;
}

function wrapList(prefix, items, pad) {
  const one = `${pad}${prefix}[${items.join(", ")}],`;
  if (one.length <= 100) return `${one}\n`;
  const lines = [`${pad}${prefix}[`];
  let cur = `${pad}  `;
  for (const item of items) {
    const piece = `${item},`;
    const filled = cur.trim() !== "";
    if (cur.length + piece.length + (filled ? 1 : 0) > 100) {
      lines.push(cur.trimEnd());
      cur = `${pad}  ${piece}`;
    } else {
      cur = `${cur}${filled ? " " : ""}${piece}`;
    }
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  lines.push(`${pad}],`);
  return `${lines.join("\n")}\n`;
}

const out = [];
out.push(`// Generated by scripts/gen-native-shark-loader.mjs (npm run native:gen-shark-loader) from the web
// shark-band loader (src/components/shark-band-loader.tsx and shark-band-loader.css); do not edit.
// Each member is the same Figma layer tree in Figma px, flattened to absolutely positioned boxes:
// static transforms are decomposed around each box's centre, and every animated box (\`m\`) has its
// 2s keyframe tracks resolved to box-local translate (px) and rotate (deg) points.
// cubic-bezier(0.5, 0, 0.5, 1) segments are sampled into linear steps so \`Animated.interpolate\`
// runs them on the native driver.
import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import type { SharkMember } from "../../src/components/shark-member";
`);
for (const name of [...usedSvgs].sort((p, q) => (imports[p] < imports[q] ? -1 : 1))) {
  out.push(`import ${name} from "../../src/assets/loading-band/${imports[name]}.svg";\n`);
}
out.push(`
export type SharkTransformOp =
  | { translateX: number }
  | { translateY: number }
  | { rotate: number }
  | { skewX: number }
  | { scaleX: number }
  | { scaleY: number };

/** An illustration layer: the SVG fills its parent box. */
export type SharkSvgPart = { s: FC<SvgProps> };

/**
 * A box at (x, y) of size w x h in its parent box (Figma px). \`t\` lists static transforms around
 * the box centre (rotate/skewX in degrees, translations in Figma px), \`bg\`/\`r\` paint it, and \`m\`
 * names its motion in SHARK_MOTIONS.
 */
export type SharkBoxPart = {
  x: number;
  y: number;
  w: number;
  h: number;
  t?: SharkTransformOp[];
  bg?: string;
  r?: number;
  m?: string;
  c?: SharkPart[];
};

export type SharkPart = SharkSvgPart | SharkBoxPart;

/** Keyframe track: progress points (0..1 of the 2s loop) and values at those points. */
export type SharkTrack = { at: number[]; v: number[] };

/** Box-local translate (Figma px) and rotate (degrees) tracks, applied around the box centre. */
export type SharkMotion = { x?: SharkTrack; y?: SharkTrack; r?: SharkTrack };

export const SHARK_LOOP_MS = 2000;

`);
out.push("export const SHARK_MEMBER_PARTS: Record<SharkMember, SharkPart[]> = {\n");
for (const id of Object.values(MEMBERS)) {
  out.push(`  ${id}: [\n${members[id].map((n) => fmtNode(n, 2)).join("\n")}\n  ],\n`);
}
out.push("};\n\n");
out.push("export const SHARK_MOTIONS: Record<string, SharkMotion> = {\n");
for (const id of Object.keys(motions).sort()) {
  out.push(`  "${id}": {\n`);
  for (const key of ["x", "y", "r"]) {
    const pts = motions[id][key];
    if (!pts) continue;
    out.push(`    ${key}: {\n`);
    out.push(wrapList("at: ", pts.map(([t]) => num(t, 5)), "      "));
    out.push(wrapList("v: ", pts.map(([, v]) => num(v, 4)), "      "));
    out.push("    },\n");
  }
  out.push("  },\n");
}
out.push("};\n");

writeFileSync(OUT, out.join(""));
console.log(
  `wrote ${OUT}: ${usedSvgs.length} parts, ${Object.keys(motions).length} motions, ` +
    `members ${Object.keys(members).join(", ")}`,
);
