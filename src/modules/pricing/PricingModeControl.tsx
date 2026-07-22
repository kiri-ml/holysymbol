import { Divide, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { BillingType } from '../../domain/types';
import { SegmentedControl } from '../../ui/segmented-control';

export type PricingModeControlProps = {
  value: BillingType;
  onChange: (value: BillingType) => void;
  ariaLabel: string;
  className?: string;
};

export function PricingModeControl({ value, onChange, ariaLabel, className }: PricingModeControlProps) {
  const { t } = useTranslation();

  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      className={className}
      options={[
        { value: 'ratio', label: t('billing.ratio'), icon: <Divide size={15} /> },
        { value: 'hourly', label: t('billing.hourly'), icon: <Timer size={15} /> },
      ]}
    />
  );
}
