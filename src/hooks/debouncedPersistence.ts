export const PERSISTENCE_DEBOUNCE_MS = 350;

export type DebouncedPersistence = {
  schedule(): void;
  flush(): void;
  cancel(): void;
};

export function createDebouncedPersistence(
  persist: () => boolean,
  delay = PERSISTENCE_DEBOUNCE_MS,
): DebouncedPersistence {
  let pending = false;
  let timer: number | undefined;

  const clearTimer = () => {
    if (timer === undefined) return;
    window.clearTimeout(timer);
    timer = undefined;
  };

  const flush = () => {
    clearTimer();
    if (!pending) return;
    if (persist()) pending = false;
  };

  return {
    schedule() {
      pending = true;
      clearTimer();
      timer = window.setTimeout(flush, delay);
    },
    flush,
    cancel() {
      clearTimer();
      pending = false;
    },
  };
}
