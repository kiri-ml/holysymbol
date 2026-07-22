import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../classNames';
import type { FieldControlSize } from '../controlSize';
import styles from './Fields.module.css';

export type FieldControlProps = HTMLAttributes<HTMLSpanElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  size?: FieldControlSize;
};

export function FieldControl({ leading, trailing, size = 'md', className, children, ...props }: FieldControlProps) {
  return (
    <span
      {...props}
      className={classNames(styles.control, leading !== undefined && styles.hasPrefix, trailing !== undefined && styles.hasSuffix, className)}
      data-size={size}
    >
      {leading !== undefined ? <span className={styles.prefix} aria-hidden="true">{leading}</span> : null}
      {children}
      {trailing !== undefined ? <span className={styles.suffix} aria-hidden="true">{trailing}</span> : null}
    </span>
  );
}
