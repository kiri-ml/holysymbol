import type { ReactNode } from 'react';
import { classNames } from '../../ui/classNames';
import { InputFields, NumberField } from '../../ui/fields';
import type { FieldControlSize, InputFieldsProps } from '../../ui/fields';
import styles from './CharacterProgressFields.module.css';
import { clampLevel, normalizePercent } from './progressValues';
import type { LevelExpValue } from './progressValues';

export type CharacterProgressFieldsProps = Omit<InputFieldsProps, 'children' | 'columns' | 'onChange'> & {
  value: LevelExpValue;
  onChange: (value: LevelExpValue) => void;
  levelLabel: ReactNode;
  expLabel: ReactNode;
  labelVisibility?: 'visible' | 'screen-reader';
  fieldSize?: FieldControlSize;
};

export function CharacterProgressFields({
  value,
  onChange,
  levelLabel,
  expLabel,
  labelVisibility = 'visible',
  fieldSize = 'md',
  className,
  ...fieldsProps
}: CharacterProgressFieldsProps) {
  return (
    <InputFields {...fieldsProps} className={classNames(styles.fields, className)}>
      <NumberField
        label={levelLabel}
        labelVisibility={labelVisibility}
        size={fieldSize}
        min={1}
        max={200}
        value={value.level}
        emptyValue={1}
        normalize={clampLevel}
        onValueChange={(level) => onChange({ ...value, level })}
      />
      <NumberField
        label={expLabel}
        labelVisibility={labelVisibility}
        size={fieldSize}
        min={0}
        max={99.99}
        step={0.01}
        value={value.expPercent}
        normalize={normalizePercent}
        onValueChange={(expPercent) => onChange({ ...value, expPercent })}
      />
    </InputFields>
  );
}
