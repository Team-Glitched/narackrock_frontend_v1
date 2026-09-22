const STORAGE_KEY = "adlips.deviceId";

/**
 * 비로그인 조회수 집계용 기기 식별자.
 *
 * 조회수 API는 `Authorization`이 없으면 `X-Device-Id`로 조회자를 가리는데, 둘 다 없으면
 * 400(VIEWER_ID_REQUIRED)이다. 같은 기기가 30분 안에 같은 글을 다시 열면 집계되지 않으므로
 * 이 값은 새로고침을 넘어 유지돼야 한다 - 그래서 localStorage에 둔다.
 *
 * 서버는 받은 값을 SHA-256으로 해싱해 보관하므로 원본이 그대로 저장되지는 않는다.
 * 그래도 추적 가능한 식별자이니 임의의 난수만 쓰고 사용자 정보는 섞지 않는다.
 *
 * 시크릿 모드나 저장소 차단 환경에서는 읽기·쓰기가 예외를 던질 수 있다. 그때는 메모리
 * 값으로 버틴다 - 탭이 살아 있는 동안은 중복 제거가 동작하고, 최악이어도 조회수가 조금
 * 더 잡힐 뿐 화면이 깨지지는 않는다.
 */
let memoryFallback: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    const created = randomId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    memoryFallback ??= randomId();
    return memoryFallback;
  }
}
