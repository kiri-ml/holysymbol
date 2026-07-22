import { cloneElement, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import type { ButtonProps } from '../button';
import { Surface } from '../surface';
import styles from './HelpPopover.module.css';

type TriggerProps = Pick<ButtonProps, 'onClick' | 'aria-controls' | 'aria-expanded' | 'aria-haspopup'>;

export type HelpPopoverProps = {
  trigger: ReactElement<TriggerProps>;
  title?: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  openOnHover?: boolean;
  className?: string;
};

export function HelpPopover({ trigger, title, children, align = 'end', openOnHover = true, className }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function supportsHover() {
    return openOnHover && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-align={align}
      data-open={open || undefined}
      onPointerEnter={() => { if (supportsHover()) setOpen(true); }}
      onPointerLeave={() => { if (supportsHover()) setOpen(false); }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      {cloneElement(trigger, {
        'aria-controls': popoverId,
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          trigger.props.onClick?.(event);
          if (!event.defaultPrevented) setOpen((current) => !current);
        },
      })}
      {open ? (
        <Surface
          id={popoverId}
          className={styles.popover}
          variant="floating"
          radius="medium"
          padding="small"
          role="dialog"
          aria-labelledby={title ? titleId : undefined}
        >
          {title ? <strong id={titleId} className={styles.title}>{title}</strong> : null}
          <div className={styles.content}>{children}</div>
        </Surface>
      ) : null}
    </div>
  );
}
