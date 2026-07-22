import type { FocusEvent, HTMLAttributes } from 'react';
import { classNames } from '../classNames';
import styles from './Fields.module.css';

export type InputFieldsProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 1 | 2 | 3;
  density?: 'default' | 'compact';
  onCommit?: () => void;
};

export function InputFields({ columns, density = 'default', onCommit, className, onBlur, ...props }: InputFieldsProps) {
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    onBlur?.(event);
    if (event.defaultPrevented) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    onCommit?.();
  }

  return (
    <div
      {...props}
      className={classNames(styles.fields, columns === 2 && styles.columns2, columns === 3 && styles.columns3, density === 'compact' && styles.compact, className)}
      onBlur={handleBlur}
    />
  );
}
