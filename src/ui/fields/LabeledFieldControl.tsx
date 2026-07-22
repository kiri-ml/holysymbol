import type { AriaAttributes, ReactNode } from 'react';
import type { FieldControlSize } from '../controlSize';
import { FieldControl } from './FieldControl';
import { InputField } from './InputField';
import { useFieldControlIds } from './useFieldControlIds';

type ControlAriaProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
};

type LabeledFieldControlProps = {
  label: ReactNode;
  labelVisibility?: 'visible' | 'screen-reader';
  size?: FieldControlSize;
  description?: ReactNode;
  error?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  id?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: AriaAttributes['aria-invalid'];
  renderControl: (props: ControlAriaProps) => ReactNode;
};

export function LabeledFieldControl({
  label,
  labelVisibility = 'visible',
  size = 'md',
  description,
  error,
  leading,
  trailing,
  className,
  id,
  ariaDescribedBy,
  ariaInvalid,
  renderControl,
}: LabeledFieldControlProps) {
  const ids = useFieldControlIds({ id, description, error, ariaDescribedBy, ariaInvalid });
  const control = renderControl({ id: ids.controlId, ...ids.controlAria });

  return (
    <InputField
      label={label}
      controlId={ids.controlId}
      labelVisibility={labelVisibility}
      size={size}
      description={description}
      descriptionId={ids.descriptionId}
      error={error}
      errorId={ids.errorId}
      className={className}
    >
      {leading !== undefined || trailing !== undefined
        ? <FieldControl leading={leading} trailing={trailing} size={size}>{control}</FieldControl>
        : control}
    </InputField>
  );
}
