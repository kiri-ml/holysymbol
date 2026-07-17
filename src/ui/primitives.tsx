import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from 'react';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export const inputClass = [
  'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2',
  'text-sm font-medium text-slate-950 shadow-sm outline-none placeholder:text-slate-400',
  'transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10',
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
  'dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 dark:disabled:bg-slate-800',
].join(' ');

export const groupedInputClass = [
  'min-h-10 min-w-0 flex-1 border-0 bg-transparent px-3 py-2',
  'text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400',
  'disabled:cursor-not-allowed disabled:text-slate-500',
  'dark:text-slate-100 dark:placeholder:text-slate-500',
].join(' ');

export const selectClass = cx(inputClass, 'appearance-none pr-9');

export const fieldLabelClass = 'grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300';

const buttonBase = [
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2',
  'text-sm font-semibold shadow-sm outline-none transition',
  'focus-visible:ring-4 focus-visible:ring-indigo-500/20',
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ');

const buttonVariants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:active:bg-indigo-300 dark:active:text-slate-950',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700',
  ghost: 'bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70',
  success: 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70',
} as const;

type ButtonVariant = keyof typeof buttonVariants;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  radius?: 'xl' | '2xl';
  tone?: 'default' | 'subtle';
};

export function Surface({
  as: Component = 'section',
  className,
  radius = '2xl',
  tone = 'default',
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cx(
        'border border-slate-200 shadow-sm dark:border-slate-800',
        radius === 'xl' ? 'rounded-xl' : 'rounded-2xl',
        tone === 'default' ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-950/40',
        className,
      )}
      {...props}
    />
  );
}

export function SegmentedControl({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cx('inline-flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800', className)}
      {...props}
    />
  );
}

export function SegmentedControlButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5',
        'text-xs font-semibold text-slate-500 outline-none transition hover:text-slate-900',
        'focus-visible:ring-2 focus-visible:ring-indigo-500/40',
        'aria-pressed:bg-white aria-pressed:text-slate-950 aria-pressed:shadow-sm',
        'dark:text-slate-400 dark:hover:text-white dark:aria-pressed:bg-slate-700 dark:aria-pressed:text-white',
        className,
      )}
      {...props}
    />
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function IconButton({ className, variant = 'ghost', ...props }: IconButtonProps) {
  return (
    <button
      className={cx(buttonBase, buttonVariants[variant], 'size-10 min-h-0 shrink-0 p-0', className)}
      {...props}
    />
  );
}

type InputGroupProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
};

export function InputGroup({ as: Component = 'div', className, ...props }: InputGroupProps) {
  return (
    <Component
      className={cx(
        'flex min-h-10 min-w-0 items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm',
        'focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10',
        'dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-400',
        className,
      )}
      {...props}
    />
  );
}

export function InputAddon({
  side = 'right',
  className,
  ...props
}: ComponentPropsWithoutRef<'span'> & { side?: 'left' | 'right' }) {
  return (
    <span
      className={cx(
        'flex shrink-0 items-center whitespace-nowrap bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-500',
        'dark:bg-slate-800 dark:text-slate-300',
        side === 'left'
          ? 'border-r border-slate-200 px-3 dark:border-slate-700'
          : 'border-l border-slate-200 dark:border-slate-700',
        className,
      )}
      {...props}
    />
  );
}

type StatProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  detailClassName?: string;
};

export function Stat({
  label,
  value,
  detail,
  className,
  labelClassName,
  valueClassName,
  detailClassName,
}: StatProps) {
  return (
    <div className={cx('grid min-w-0 gap-1 text-left', className)}>
      <span className={cx('text-xs font-semibold text-slate-500 dark:text-slate-400', labelClassName)}>{label}</span>
      <strong className={cx('truncate font-bold text-slate-950 dark:text-white', valueClassName)}>{value}</strong>
      {detail === undefined ? null : (
        <small className={cx('truncate text-xs text-slate-500 dark:text-slate-400', detailClassName)}>{detail}</small>
      )}
    </div>
  );
}

export function Tooltip({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('group relative', className)} {...props} />;
}

export function TooltipContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cx(
        'pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-80 translate-y-1',
        'rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 opacity-0 shadow-xl transition',
        'group-hover:visible group-hover:translate-y-0 group-hover:opacity-100',
        'group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
        'max-sm:left-0 max-sm:right-auto max-sm:w-full',
        className,
      )}
      {...props}
    />
  );
}
