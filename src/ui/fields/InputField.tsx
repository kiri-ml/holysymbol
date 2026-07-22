import type { ReactNode } from 'react';
import { classNames } from '../classNames';
import type { FieldControlSize } from '../controlSize';
import styles from './Fields.module.css';

export type InputFieldProps = {
  label: ReactNode;
  controlId: string;
  labelVisibility?: 'visible' | 'screen-reader';
  size?: FieldControlSize;
  description?: ReactNode;
  descriptionId?: string;
  error?: ReactNode;
  errorId?: string;
  children: ReactNode;
  className?: string;
};

export function InputField({
  label,
  controlId,
  labelVisibility = 'visible',
  size = 'md',
  description,
  descriptionId,
  error,
  errorId,
  children,
  className,
}: InputFieldProps) {
  return (
    <div
      className={classNames(styles.field, labelVisibility === 'screen-reader' && styles.screenReaderField, className)}
      data-size={size}
    >
      <label className={classNames(styles.label, labelVisibility === 'screen-reader' && styles.screenReaderOnly)} htmlFor={controlId}>
        {label}
      </label>
      {children}
      {description ? <small id={descriptionId} className={styles.description}>{description}</small> : null}
      {error ? <small id={errorId} className={styles.error} role="alert">{error}</small> : null}
    </div>
  );
}
