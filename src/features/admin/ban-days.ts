/**
 * The ban length typed when handling a report with 작성자 정지: empty means permanent, otherwise a
 * whole number of days from 1. Pure, so the app's native screen uses the same rule.
 */
export function parseBanDays(text: string): { banDays: number | null; valid: boolean } {
  const banDays = text.trim() === "" ? null : Number(text);
  return { banDays, valid: banDays === null || (Number.isInteger(banDays) && banDays >= 1) };
}
