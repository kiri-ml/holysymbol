import { useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { classNames } from '../classNames';
import type { FieldControlSize } from '../controlSize';
import styles from './Fields.module.css';

export type NumberInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'onChange' | 'size'> & {
  value: number;
  onValueChange: (value: number) => void;
  emptyValue?: number;
  normalize?: (value: number) => number;
  blurOnEnter?: boolean;
  emitEmptyOnChange?: boolean;
  controlSize?: FieldControlSize;
};

function numberInputText(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

export function NumberInput({
  value,
  onValueChange,
  emptyValue = 0,
  normalize = (nextValue) => nextValue,
  blurOnEnter = true,
  emitEmptyOnChange = false,
  controlSize = 'md',
  onBlur,
  onFocus,
  onKeyDown,
  className,
  ...inputProps
}: NumberInputProps) {
  const [text, setText] = useState(numberInputText(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(numberInputText(value));
  }, [value]);

  function parseText(raw: string) {
    if (raw === '') return emptyValue;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : emptyValue;
  }

  return (
    <input
      {...inputProps}
      type="number"
      className={classNames(styles.input, className)}
      data-size={controlSize}
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const normalized = normalize(parseText(text));
        setText(numberInputText(normalized));
        onValueChange(normalized);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (blurOnEnter && !event.defaultPrevented && event.key === 'Enter') event.currentTarget.blur();
      }}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        if (nextText === '') {
          if (emitEmptyOnChange) onValueChange(emptyValue);
          return;
        }
        const parsed = Number(nextText);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
    />
  );
}
