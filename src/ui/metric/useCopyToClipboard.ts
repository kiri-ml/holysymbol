import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyStatus = 'idle' | 'copied' | 'error';

export type UseCopyToClipboardOptions = {
  text: string | null;
  resetAfter?: number;
  onError?: (error: unknown) => void;
};

export function useCopyToClipboard({ text, resetAfter = 1600, onError }: UseCopyToClipboardOptions) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const resetTimerRef = useRef<number | undefined>(undefined);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current === undefined) return;
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = undefined;
  }, []);

  const reset = useCallback(() => {
    clearResetTimer();
    setStatus('idle');
  }, [clearResetTimer]);

  const copy = useCallback(async () => {
    if (text === null) return false;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      clearResetTimer();
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = undefined;
        setStatus('idle');
      }, resetAfter);
      return true;
    } catch (error) {
      setStatus('error');
      onError?.(error);
      return false;
    }
  }, [clearResetTimer, onError, resetAfter, text]);

  useEffect(() => {
    reset();
  }, [reset, text]);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  return { copy, reset, status, copied: status === 'copied' };
}
