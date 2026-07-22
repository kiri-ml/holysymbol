import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { HeadingGroup } from '../heading';
import { Surface } from '../surface';
import styles from './Modal.module.css';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export type ModalProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onDismiss: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  width?: string;
};

export function Modal({ title, description, children, footer, onDismiss, initialFocusRef, width }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (initialFocusRef?.current ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialogRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [initialFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])];
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.frame}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{ '--modal-width': width } as CSSProperties}
      >
        <Surface className={styles.surface} variant="floating" padding="none">
          <div className={styles.content}>
            <HeadingGroup title={title} headingLevel={2} size="medium" titleId={titleId} />
            {description ? <div id={descriptionId} className={styles.description}>{description}</div> : null}
            {children ? <div className={styles.body}>{children}</div> : null}
          </div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </Surface>
      </div>
    </div>
  );
}
