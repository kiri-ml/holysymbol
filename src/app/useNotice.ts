import { useCallback, useState } from 'react';
import type { Notice } from './notice';

export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    notice,
    showNotice: setNotice,
    dismissNotice,
  };
}
