/** CSS rotates the studio clockwise in portrait; convert pointer axes back to its logical plane. */
export function logicalPoint(x: number, y: number, rotated: boolean) {
  return rotated ? { x: y, y: -x } : { x, y };
}
export function isRotated(element: Element) {
  const studio = element.closest<HTMLElement>(".studio");
  return Boolean(
    studio && getComputedStyle(studio).getPropertyValue("--studio-rotated").trim() === "1",
  );
}
function canvasScale(element: Element) {
  const host = element.closest(".design-viewport");
  return host ? Number(getComputedStyle(host).getPropertyValue("--canvas-scale")) || 1 : 1;
}
export function pointerAxes(element: Element, point: { clientX: number; clientY: number }) {
  return logicalPoint(
    point.clientX / canvasScale(element),
    point.clientY / canvasScale(element),
    isRotated(element),
  );
}
export function logicalBounds(element: Element) {
  const bounds = element.getBoundingClientRect();
  const scale = canvasScale(element);
  const rect = {
    left: bounds.left / scale,
    top: bounds.top / scale,
    right: bounds.right / scale,
    width: bounds.width / scale,
    height: bounds.height / scale,
  };
  return isRotated(element)
    ? { left: rect.top, top: -rect.right, width: rect.height, height: rect.width }
    : { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}
