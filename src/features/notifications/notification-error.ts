export function notificationError(cause: unknown): string {
  if (cause instanceof TypeError) return "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  return cause instanceof Error ? cause.message : "알림을 처리하지 못했습니다. 다시 시도해 주세요.";
}
