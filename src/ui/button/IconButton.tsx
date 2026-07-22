import type { ReactNode } from 'react';
import { Button } from './Button';
import type { ButtonProps, ButtonSize } from './Button';
import styles from './Button.module.css';

export type IconButtonProps = Omit<ButtonProps, 'children' | 'icon' | 'label' | 'labelMode' | 'size'> & {
  icon: ReactNode;
  'aria-label': string;
  size?: ButtonSize;
};

export function IconButton({ icon, size = 'md', ...props }: IconButtonProps) {
  return <Button {...props} className={[styles.iconButton, props.className].filter(Boolean).join(' ')} size={size} icon={icon} labelMode="hidden" />;
}
