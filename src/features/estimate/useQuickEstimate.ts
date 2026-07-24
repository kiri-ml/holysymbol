import { useLocalStorage } from '../../hooks/useLocalStorage';
import { PERSISTENCE_DEBOUNCE_MS } from '../../hooks/debouncedPersistence';
import { DEFAULT_ESTIMATE, ESTIMATE_STORAGE_KEY } from './estimateState';
import type { QuickEstimateState } from './estimateState';

export function useQuickEstimate() {
  return useLocalStorage<QuickEstimateState>(ESTIMATE_STORAGE_KEY, DEFAULT_ESTIMATE, {
    debounceMs: PERSISTENCE_DEBOUNCE_MS,
    flushOnHide: true,
  });
}
