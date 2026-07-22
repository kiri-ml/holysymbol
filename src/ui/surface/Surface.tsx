import { createElement, type HTMLAttributes } from 'react';
import { classNames } from '../classNames';
import styles from './Surface.module.css';

export type SurfaceVariant = 'default' | 'subtle' | 'floating';
export type SurfaceRadius = 'medium' | 'large' | 'pill';
export type SurfacePadding = 'none' | 'small' | 'medium' | 'large';
export type SurfaceElement = 'div' | 'section' | 'article' | 'header' | 'aside';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  variant?: SurfaceVariant;
  radius?: SurfaceRadius;
  padding?: SurfacePadding;
};

export function Surface({
  as = 'div',
  variant = 'default',
  radius = 'large',
  padding = 'medium',
  className,
  ...props
}: SurfaceProps) {
  return createElement(as, {
    ...props,
    className: classNames(styles.root, className),
    'data-variant': variant,
    'data-radius': radius,
    'data-padding': padding,
  });
}
