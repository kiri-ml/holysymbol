import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmContext } from './ConfirmContext';
import { ConfirmDialog } from './ConfirmDialog';
import type { Confirm, ConfirmOptions } from './confirmation';

type ConfirmRequest = {
  id: number;
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const pendingRef = useRef<ConfirmRequest[]>([]);
  const [pending, setPending] = useState<ConfirmRequest[]>([]);

  const confirm = useCallback<Confirm>((options) => new Promise<boolean>((resolve) => {
    const request = { id: nextId.current, options, resolve };
    nextId.current += 1;
    const next = [...pendingRef.current, request];
    pendingRef.current = next;
    setPending(next);
  }), []);

  const settle = useCallback((confirmed: boolean) => {
    const [active, ...remaining] = pendingRef.current;
    if (!active) return;
    pendingRef.current = remaining;
    setPending(remaining);
    active.resolve(confirmed);
  }, []);

  useEffect(() => () => {
    const unresolved = pendingRef.current;
    pendingRef.current = [];
    for (const request of unresolved) request.resolve(false);
  }, []);

  const active = pending[0];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {active ? (
        <ConfirmDialog
          key={active.id}
          options={active.options}
          onCancel={() => settle(false)}
          onConfirm={() => settle(true)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}
