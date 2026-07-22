import { useLocalStorage } from '../../hooks/useLocalStorage';
import { DEFAULT_ESTIMATE, ESTIMATE_STORAGE_KEY } from './estimateState';
import type { QuickEstimateState } from './estimateState';

export function useQuickEstimate() {
  return useLocalStorage<QuickEstimateState>(ESTIMATE_STORAGE_KEY, DEFAULT_ESTIMATE);
}
