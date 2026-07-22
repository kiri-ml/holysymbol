import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { classNames } from '../../ui/classNames';
import { NumberField } from '../../ui/fields';
import type { FieldControlSize, NumberFieldProps } from '../../ui/fields';
import styles from './Pricing.module.css';
import { normalizeRatio } from './pricingValues';

export type RatioRateFieldProps = Omit<
  NumberFieldProps,
  'value' | 'onValueChange' | 'leading' | 'min' | 'step' | 'emptyValue' | 'normalize' | 'label' | 'size'
> & {
  value: number;
  onChange: (value: number) => void;
  label: ReactNode;
  width?: 'default' | 'full';
  size?: FieldControlSize;
};

export function RatioRateField({
  value,
  onChange,
  label,
  width = 'default',
  size = 'md',
  className,
  ...props
}: RatioRateFieldProps) {
  const { t } = useTranslation();
  return (
    <NumberField
      {...props}
      className={classNames(styles.ratioField, width === 'full' && styles.fullWidth, className)}
      size={size}
      label={label}
      leading={t('common.ratioPrefix')}
      min={0.1}
      step={0.1}
      value={value}
      emptyValue={0.1}
      normalize={normalizeRatio}
      onValueChange={onChange}
    />
  );
}
