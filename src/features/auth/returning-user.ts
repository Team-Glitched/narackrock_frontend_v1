// 로그인 전에는 처음 온 사람인지 서버가 알려주지 않으므로, 이 브라우저에서 로그인한 적이 있는지로
// 로그인 화면 인사말만 고른다. 저장소를 쓸 수 없으면 처음 방문으로 본다.
const storageKey = "narackrock.has-signed-in";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function hasSignedInBefore(
  storage: ReadableStorage | undefined = browserStorage(),
): boolean {
  try {
    return storage?.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function rememberSignedIn(storage: WritableStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(storageKey, "1");
  } catch {
    // 저장하지 못해도 로그인 동작에는 영향이 없다.
  }
}
