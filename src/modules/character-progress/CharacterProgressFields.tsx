import type { ReactNode } from 'react';
import { InputFields, NumberField } from '../../ui/fields';
import type { FieldControlSize, InputFieldsProps } from '../../ui/fields';
import { clampLevel, normalizePercent } from './progressValues';
import type { LevelExpValue } from './progressValues';

export type CharacterProgressFieldsProps = Omit<InputFieldsProps, 'children' | 'columns' | 'onChange'> & {
  value: LevelExpValue;
  onChange: (value: LevelExpValue) => void;
  levelLabel: ReactNode;
  expLabel: ReactNode;
  labelVisibility?: 'visible' | 'screen-reader';
  fieldSize?: FieldControlSize;
  layout?: 'two-column' | 'inherit';
};

export function CharacterProgressFields({
  value,
  onChange,
  levelLabel,
  expLabel,
  labelVisibility = 'visible',
  fieldSize = 'md',
  layout = 'two-column',
  ...fieldsProps
}: CharacterProgressFieldsProps) {
  return (
    <InputFields {...fieldsProps} columns={layout === 'two-column' ? 2 : undefined}>
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
        max={99.999}
        step={0.01}
        value={value.expPercent}
        normalize={normalizePercent}
        onValueChange={(expPercent) => onChange({ ...value, expPercent })}
      />
    </InputFields>
  );
}
