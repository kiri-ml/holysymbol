import { LoaderCircle } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { classNames } from '../classNames';
import type { ControlSize } from '../controlSize';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = ControlSize;
export type ButtonLabelMode = 'visible' | 'responsive' | 'hidden';
export type ButtonCollapsePriority = 'low' | 'high';

export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: ReactNode;
  icon?: ReactNode;
  label?: ReactNode;
  labelMode?: ButtonLabelMode;
  collapsePriority?: ButtonCollapsePriority;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  type = 'button',
  className,
  disabled,
  children,
  icon,
  label,
  labelMode = 'visible',
  collapsePriority = 'low',
  ...props
}: ButtonProps) {
  const effectiveLabelMode = labelMode === 'responsive' && icon === undefined ? 'visible' : labelMode;
  const visibleLabel = loading && loadingLabel !== undefined ? loadingLabel : label;
  const accessibleLabel = typeof visibleLabel === 'string' || typeof visibleLabel === 'number' ? String(visibleLabel) : undefined;
  const effectiveIcon = loading ? <LoaderCircle className={styles.spinner} /> : icon;

  return (
    <button
      {...props}
      type={type}
      className={classNames(styles.root, className)}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy'] || undefined}
      aria-label={props['aria-label'] ?? (effectiveLabelMode !== 'visible' ? accessibleLabel : undefined)}
      data-responsive-button={effectiveLabelMode === 'responsive' ? collapsePriority : undefined}
    >
      {effectiveIcon !== undefined && <span className={styles.contentIcon} aria-hidden="true">{effectiveIcon}</span>}
      {visibleLabel !== undefined && (
        <span
          className={classNames(styles.contentLabel, effectiveLabelMode === 'hidden' && styles.contentLabelHidden)}
          data-responsive-button-label={effectiveLabelMode === 'responsive' || undefined}
        >
          {visibleLabel}
        </span>
      )}
      {children}
    </button>
  );
}
