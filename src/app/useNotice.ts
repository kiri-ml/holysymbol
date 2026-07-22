import { useEffect, useState } from 'react';
import type { Notice } from './notice';

const SUCCESS_NOTICE_MS = 4000;

export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice?.transient) return;
    const id = window.setTimeout(() => setNotice(null), SUCCESS_NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  return {
    notice,
    showNotice: setNotice,
    dismissNotice: () => setNotice(null),
  };
}
