import { Check, Copy } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '../button/Button';
import { classNames } from '../classNames';
import styles from './Metric.module.css';
import { useCopyToClipboard } from './useCopyToClipboard';

export type CopyMetricProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'value'> & {
  label: ReactNode;
  copiedLabel: ReactNode;
  displayValue: ReactNode;
  detail?: ReactNode;
  copyText: string | null;
  copyAriaLabel: string;
  copiedAriaLabel: string;
  appearance?: 'card' | 'plain';
  variant?: 'default' | 'compact';
  resetAfter?: number;
  onCopyError?: (error: unknown) => void;
};

export function CopyMetric({
  label,
  copiedLabel,
  displayValue,
  detail,
  copyText,
  copyAriaLabel,
  copiedAriaLabel,
  appearance = 'card',
  variant = 'default',
  resetAfter,
  onCopyError,
  className,
  disabled,
  ...props
}: CopyMetricProps) {
  const copy = useCopyToClipboard({ text: copyText, resetAfter, onError: onCopyError });

  return (
    <Button
      {...props}
      type="button"
      variant={appearance === 'card' ? 'soft' : 'ghost'}
      className={classNames(styles.root, styles.copyButton, appearance === 'card' && styles.copyAppearance, className)}
      data-metric-variant={variant}
      data-copied={copy.copied || undefined}
      disabled={disabled}
      aria-label={copy.copied ? copiedAriaLabel : copyAriaLabel}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) void copy.copy();
      }}
    >
      <span className={classNames(styles.label, styles.copyLabel)} aria-live="polite">
        {copy.copied ? copiedLabel : label}
        {copy.copied ? <Check size={13} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      </span>
      <strong className={styles.value}>{displayValue}</strong>
      {detail !== undefined && detail !== null ? <small className={styles.detail}>{detail}</small> : null}
    </Button>
  );
}
