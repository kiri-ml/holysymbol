import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../classNames';
import styles from './Metric.module.css';

export type MetricProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: ReactNode;
  displayValue: ReactNode;
  detail?: ReactNode;
  variant?: 'default' | 'compact';
};

export function Metric({ label, displayValue, detail, variant = 'default', className, ...props }: MetricProps) {
  return (
    <div {...props} className={classNames(styles.root, className)} data-metric-variant={variant}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value}>{displayValue}</strong>
      {detail !== undefined && detail !== null ? <small className={styles.detail}>{detail}</small> : null}
    </div>
  );
}
