import type { ReactNode } from 'react';
import type { FieldControlSize } from '../controlSize';
import { LabeledFieldControl } from './LabeledFieldControl';
import { SelectInput } from './SelectInput';
import type { SelectInputProps } from './SelectInput';

export type SelectFieldProps = Omit<SelectInputProps, 'className' | 'controlSize'> & {
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

export function SelectField({
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
  ...selectProps
}: SelectFieldProps) {
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
        <SelectInput {...selectProps} {...controlProps} className={inputClassName} controlSize={size} />
      )}
    />
  );
}
