import type { ComponentPropsWithoutRef } from 'react';
import { classNames } from '../classNames';
import { Surface } from '../surface';
import styles from './Panel.module.css';

export type PanelProps = ComponentPropsWithoutRef<'section'> & { highlighted?: boolean };

export function Panel({ highlighted = false, className, ...props }: PanelProps) {
  return (
    <Surface
      {...props}
      as="section"
      className={classNames(styles.root, className)}
      padding="medium"
      data-highlighted={highlighted || undefined}
    />
  );
}
