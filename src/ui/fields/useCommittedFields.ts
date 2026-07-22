import { useCallback, useEffect, useRef } from 'react';

export type CommittedFieldUpdate<T> = Partial<T> | ((current: T) => T);

export type UseCommittedFieldsOptions<T extends object> = {
  value: T;
  onChange: (value: T) => void;
  onCommit?: (value: T) => void;
  normalize?: (value: T) => T;
  delay?: number;
};

export function useCommittedFields<T extends object>({
  value,
  onChange,
  onCommit,
  normalize = (nextValue) => nextValue,
  delay = 350,
}: UseCommittedFieldsOptions<T>) {
  const valueRef = useRef(value);
  const commitTimerRef = useRef<number | undefined>(undefined);
  valueRef.current = value;

  const cancel = useCallback(() => {
    if (commitTimerRef.current === undefined) return;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = undefined;
  }, []);

  const commit = useCallback(() => {
    cancel();
    const normalized = normalize(valueRef.current);
    valueRef.current = normalized;
    onChange(normalized);
    onCommit?.(normalized);
  }, [cancel, normalize, onChange, onCommit]);

  const scheduleCommit = useCallback(() => {
    if (!onCommit) return;
    cancel();
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = undefined;
      const normalized = normalize(valueRef.current);
      valueRef.current = normalized;
      onChange(normalized);
      onCommit(normalized);
    }, delay);
  }, [cancel, delay, normalize, onChange, onCommit]);

  const update = useCallback((updateValue: CommittedFieldUpdate<T>) => {
    const nextValue = typeof updateValue === 'function'
      ? updateValue(valueRef.current)
      : { ...valueRef.current, ...updateValue };
    valueRef.current = nextValue;
    onChange(nextValue);
    scheduleCommit();
  }, [onChange, scheduleCommit]);

  useEffect(() => cancel, [cancel]);

  return { update, commit, cancel };
}
