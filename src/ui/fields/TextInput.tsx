import type { ComponentPropsWithoutRef } from 'react';
import { classNames } from '../classNames';
import type { FieldControlSize } from '../controlSize';
import styles from './Fields.module.css';

export type TextInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'> & {
  type?: 'text' | 'search' | 'email' | 'url' | 'password';
  controlSize?: FieldControlSize;
};

export function TextInput({ type = 'text', controlSize = 'md', className, ...props }: TextInputProps) {
  return <input {...props} type={type} className={classNames(styles.input, className)} data-size={controlSize} />;
}
