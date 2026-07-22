import type { HTMLAttributes } from 'react';
import { classNames } from '../classNames';
import styles from './ControlGroup.module.css';

export type ControlGroupProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical';
  joined?: boolean;
  width?: 'auto' | 'full';
};

export function ControlGroup({ orientation = 'horizontal', joined = true, width = 'auto', className, ...props }: ControlGroupProps) {
  return (
    <div
      {...props}
      className={classNames(styles.root, className)}
      data-orientation={orientation}
      data-joined={joined || undefined}
      data-width={width}
    />
  );
}
