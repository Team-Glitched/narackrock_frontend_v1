export const MIN_ROLL_ZOOM = 0.5;
export const MAX_ROLL_ZOOM = 2.5;
export const clampRollZoom = (value: number) =>
  Math.max(MIN_ROLL_ZOOM, Math.min(MAX_ROLL_ZOOM, value));
export type RollPoint = { x: number; y: number };
export type RollViewport = {
  width: number;
  height: number;
  baseKeyWidth: number;
  baseRowHeight: number;
  baseWindowTicks: number;
  maxTick: number;
  rows: number;
  zoom: number;
  viewStartTick: number;
  scrollTop: number;
};
const clamp = (value: number, max: number) => Math.max(0, Math.min(Math.max(0, max), value));

/** Points are relative to the viewport below the ruler, including the keyboard column. */
export function zoomRollViewport(view: RollViewport, value: number, from: RollPoint, to = from) {
  const zoom = clampRollZoom(value);
  const oldPpt =
    Math.max(1, view.width - view.baseKeyWidth * view.zoom) / (view.baseWindowTicks / view.zoom);
  const newPpt = Math.max(1, view.width - view.baseKeyWidth * zoom) / (view.baseWindowTicks / zoom);
  const tick = view.viewStartTick + Math.max(0, from.x - view.baseKeyWidth * view.zoom) / oldPpt;
  const row = (view.scrollTop + from.y) / (view.baseRowHeight * view.zoom);
  return {
    zoom,
    viewStartTick: clamp(
      tick - Math.max(0, to.x - view.baseKeyWidth * zoom) / newPpt,
      view.maxTick - view.baseWindowTicks / zoom,
    ),
    scrollTop: clamp(
      row * view.baseRowHeight * zoom - to.y,
      view.rows * view.baseRowHeight * zoom - view.height,
    ),
  };
}

export function rollTouchPair(points: RollPoint[]) {
  const [a, b] = points;
  return {
    centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
  };
}
