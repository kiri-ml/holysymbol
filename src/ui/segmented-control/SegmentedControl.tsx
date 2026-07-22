import type { ReactNode } from 'react';
import { Button, type ButtonCollapsePriority } from '../button';
import { classNames } from '../classNames';
import styles from './SegmentedControl.module.css';

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean };
export type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
  collapseLabels?: ButtonCollapsePriority | 'never';
};

export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel, size = 'md', className, collapseLabels = 'never' }: SegmentedControlProps<T>) {
  return (
    <div className={classNames(styles.root, className)} role="group" aria-label={ariaLabel} data-size={size}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size={size === 'sm' ? 'xs' : 'sm'}
            className={styles.option}
            data-active={active || undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            icon={option.icon}
            label={option.label}
            labelMode={collapseLabels === 'never' || option.icon === undefined ? 'visible' : 'responsive'}
            collapsePriority={collapseLabels === 'never' ? undefined : collapseLabels}
          />
        );
      })}
    </div>
  );
}
