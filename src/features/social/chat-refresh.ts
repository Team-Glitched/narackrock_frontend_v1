/** Serializes REST refreshes, retaining one trailing refresh when events arrive in flight. */
export function createChatRefresh<T>(options: {
  load: () => Promise<T>;
  isCurrent: () => boolean;
  onSuccess: (value: T) => void;
  onError: (cause: unknown) => void;
}) {
  let disposed = false;
  let running = false;
  let queued = false;
  const current = () => !disposed && options.isCurrent();
  async function drain() {
    running = true;
    do {
      queued = false;
      try {
        const value = await options.load();
        if (current()) options.onSuccess(value);
      } catch (cause) {
        if (current()) options.onError(cause);
      }
    } while (queued && current());
    running = false;
  }
  return {
    request() {
      if (!current()) return;
      if (running) queued = true;
      else void drain();
    },
    dispose() {
      disposed = true;
      queued = false;
    },
  };
}
