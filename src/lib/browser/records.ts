/** IndexedDB stores files without converting large attachments to localStorage strings. */
let database: Promise<IDBDatabase> | null = null;
function openDatabase() {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("브라우저 저장소를 사용할 수 없습니다."));
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("narackrock-local-files", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("records"))
          request.result.createObjectStore("records");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = null;
        };
        resolve(db);
      };
      request.onblocked = () => {
        database = null;
        reject(new Error("저장소를 열지 못했습니다. 다른 탭을 닫은 후 다시 시도해주세요."));
      };
      request.onerror = () => {
        database = null;
        reject(request.error);
      };
    });
  return database;
}
const pending = new Map<string, Promise<unknown>>();
function sequence<T>(key: string, task: () => Promise<T>): Promise<T> {
  const next = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  pending.set(key, next);
  void next
    .finally(() => {
      if (pending.get(key) === next) pending.delete(key);
    })
    .catch(() => {});
  return next;
}
export function writeBrowserRecord(key: string, value: unknown) {
  return sequence(key, async () => {
    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("records", "readwrite");
      transaction.objectStore("records").put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}
export function deleteBrowserRecord(key: string) {
  return sequence(key, async () => {
    const db = await openDatabase();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("records", "readwrite");
      transaction.objectStore("records").delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}
export async function readBrowserRecord<T>(key: string): Promise<T | undefined> {
  await pending.get(key)?.catch(() => {});
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records", "readonly").objectStore("records").get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}
