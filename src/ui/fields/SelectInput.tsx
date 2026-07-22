import type { ComponentPropsWithoutRef } from 'react';
import { classNames } from '../classNames';
import type { FieldControlSize } from '../controlSize';
import styles from './Fields.module.css';

export type SelectInputProps = Omit<ComponentPropsWithoutRef<'select'>, 'size'> & {
  controlSize?: FieldControlSize;
};

export function SelectInput({ controlSize = 'md', className, ...props }: SelectInputProps) {
  return <select {...props} className={classNames(styles.input, styles.select, className)} data-size={controlSize} />;
}
