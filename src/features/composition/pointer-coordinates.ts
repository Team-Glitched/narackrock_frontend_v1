/** The design canvas is scaled to fit the window; convert pointer and element geometry back to its units. */
function canvasScale(element: Element) {
  const host = element.closest(".design-viewport");
  return host ? Number(getComputedStyle(host).getPropertyValue("--canvas-scale")) || 1 : 1;
}
export function pointerAxes(element: Element, point: { clientX: number; clientY: number }) {
  const scale = canvasScale(element);
  return { x: point.clientX / scale, y: point.clientY / scale };
}
export function logicalBounds(element: Element) {
  const bounds = element.getBoundingClientRect();
  const scale = canvasScale(element);
  return {
    left: bounds.left / scale,
    top: bounds.top / scale,
    width: bounds.width / scale,
    height: bounds.height / scale,
  };
}
