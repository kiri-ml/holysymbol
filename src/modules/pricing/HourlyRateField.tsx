import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { classNames } from '../../ui/classNames';
import { NumberField } from '../../ui/fields';
import type { FieldControlSize, NumberFieldProps } from '../../ui/fields';
import styles from './Pricing.module.css';
import { mesosToMillions, millionsToMesos, normalizeNonNegativeHundredth } from './pricingValues';

export type HourlyRateFieldProps = Omit<
  NumberFieldProps,
  'value' | 'onValueChange' | 'trailing' | 'min' | 'step' | 'normalize' | 'label' | 'size'
> & {
  valueMesos: number;
  onChangeMesos: (value: number) => void;
  label: ReactNode;
  trailing?: ReactNode | false;
  layout?: 'default' | 'billing';
  size?: FieldControlSize;
};

export function HourlyRateField({
  valueMesos,
  onChangeMesos,
  label,
  trailing,
  layout = 'default',
  size = 'md',
  className,
  ...props
}: HourlyRateFieldProps) {
  const { t } = useTranslation();

  return (
    <NumberField
      {...props}
      className={classNames(layout === 'billing' && styles.billingField, className)}
      size={size}
      label={label}
      trailing={trailing === false ? undefined : (trailing ?? t('common.millionPerHourSpaced'))}
      min={0}
      step={0.5}
      value={mesosToMillions(valueMesos)}
      normalize={normalizeNonNegativeHundredth}
      onValueChange={(millions) => onChangeMesos(millionsToMesos(millions))}
    />
  );
}
