import { useId, type AriaAttributes, type ReactNode } from 'react';

export function useFieldControlIds({
  id,
  description,
  error,
  ariaDescribedBy,
  ariaInvalid,
}: {
  id?: string;
  description?: ReactNode;
  error?: ReactNode;
  ariaDescribedBy?: string;
  ariaInvalid?: AriaAttributes['aria-invalid'];
}) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return {
    controlId,
    descriptionId,
    errorId,
    controlAria: {
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : ariaInvalid,
    },
  };
}
