import { formatMesosShort, formatMesosShortPrecise, formatMesosValue } from '../../domain/format';
import { CopyMetric } from './CopyMetric';
import type { CopyMetricProps } from './CopyMetric';

export type CopyMesosMetricProps = Omit<CopyMetricProps, 'displayValue' | 'detail' | 'copyText'> & {
  value: number | undefined;
  format?: 'short' | 'precise';
};

export function CopyMesosMetric({ value, format = 'short', ...props }: CopyMesosMetricProps) {
  const finiteValue = value !== undefined && Number.isFinite(value) ? value : undefined;

  return (
    <CopyMetric
      {...props}
      displayValue={format === 'precise' ? formatMesosShortPrecise(finiteValue) : formatMesosShort(finiteValue)}
      detail={formatMesosValue(finiteValue)}
      copyText={finiteValue === undefined ? null : String(Math.max(0, Math.round(finiteValue)))}
    />
  );
}
