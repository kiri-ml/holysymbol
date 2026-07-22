import type { ReactNode } from 'react';
import type { FieldControlSize } from '../controlSize';
import { LabeledFieldControl } from './LabeledFieldControl';
import { NumberInput } from './NumberInput';
import type { NumberInputProps } from './NumberInput';

export type NumberFieldProps = Omit<NumberInputProps, 'className' | 'controlSize'> & {
  label: ReactNode;
  labelVisibility?: 'visible' | 'screen-reader';
  size?: FieldControlSize;
  description?: ReactNode;
  error?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  inputClassName?: string;
};

export function NumberField({
  label,
  labelVisibility = 'visible',
  size = 'md',
  description,
  error,
  leading,
  trailing,
  className,
  inputClassName,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...inputProps
}: NumberFieldProps) {
  return (
    <LabeledFieldControl
      label={label}
      labelVisibility={labelVisibility}
      size={size}
      description={description}
      error={error}
      leading={leading}
      trailing={trailing}
      className={className}
      id={id}
      ariaDescribedBy={ariaDescribedBy}
      ariaInvalid={ariaInvalid}
      renderControl={(controlProps) => (
        <NumberInput {...inputProps} {...controlProps} className={inputClassName} controlSize={size} />
      )}
    />
  );
}
