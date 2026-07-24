import type { HTMLAttributes } from 'react';
import { classNames } from '../classNames';
import styles from './Fields.module.css';

export type InputFieldsProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 1 | 2 | 3;
  density?: 'default' | 'compact';
};

export function InputFields({ columns, density = 'default', className, ...props }: InputFieldsProps) {
  return (
    <div
      {...props}
      className={classNames(styles.fields, columns === 2 && styles.columns2, columns === 3 && styles.columns3, density === 'compact' && styles.compact, className)}
    />
  );
}
