import type { ReactNode } from 'react';
import type { FieldControlSize } from '../controlSize';
import { LabeledFieldControl } from './LabeledFieldControl';
import { TextInput } from './TextInput';
import type { TextInputProps } from './TextInput';

export type TextFieldProps = Omit<TextInputProps, 'className' | 'controlSize'> & {
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

export function TextField({
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
}: TextFieldProps) {
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
        <TextInput {...inputProps} {...controlProps} className={inputClassName} controlSize={size} />
      )}
    />
  );
}
