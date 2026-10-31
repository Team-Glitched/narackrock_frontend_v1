export const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.";

export const clockTime = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export const subscribeToDraft = () => () => {};

export const storedDraftId = () => {
  const value = Number(window.localStorage.getItem("glitched-composition-draft-id"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};
