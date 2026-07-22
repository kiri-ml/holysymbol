import type { CSSProperties, HTMLAttributes } from 'react';
import { classNames } from '../classNames';
import styles from './Metric.module.css';

export type MetricGroupProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 1 | 2 | 3 | 4;
  dividers?: boolean;
  padding?: 'none' | 'small' | 'medium';
};

export function MetricGroup({ columns = 1, dividers = true, padding = 'medium', className, style, ...props }: MetricGroupProps) {
  return (
    <div
      {...props}
      className={classNames(styles.group, className)}
      data-dividers={dividers || undefined}
      data-padding={padding}
      style={{ ...style, '--metric-group-default-columns': columns } as CSSProperties}
    />
  );
}
