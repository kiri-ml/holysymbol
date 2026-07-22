import type { ReactNode } from 'react';

export type ConfirmTone = 'default' | 'danger';

export type ConfirmOptions = {
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: ConfirmTone;
};

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;
