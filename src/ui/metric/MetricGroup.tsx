import type { HTMLAttributes } from 'react';
import { classNames } from '../classNames';
import styles from './Metric.module.css';

export type MetricGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
  columns?: 1 | 2 | 3 | 4;
  dividers?: boolean;
  padding?: 'none' | 'small' | 'medium';
};

export function MetricGroup({ columns = 1, dividers = true, padding = 'medium', className, ...props }: MetricGroupProps) {
  return (
    <div
      {...props}
      className={classNames(styles.group, className)}
      data-columns={columns}
      data-dividers={dividers || undefined}
      data-padding={padding}
    />
  );
}
