/**
 * Where a released bottom-sheet drag settles, from the sheet's visible height in a frame of `frameHeight`:
 * well below the middle closes, near the middle rests at half the frame, and above that returns to full.
 */
export function sheetSnap(height: number, frameHeight: number): "closed" | "half" | "full" {
  const half = frameHeight / 2;
  const tolerance = frameHeight * 0.1;
  if (height < half - tolerance) return "closed";
  if (height <= half + tolerance) return "half";
  return "full";
}
