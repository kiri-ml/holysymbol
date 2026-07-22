import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../classNames';
import { HeadingGroup } from '../heading';
import styles from './Panel.module.css';

export type PanelHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function PanelHeader({ title, subtitle, actions, className, ...props }: PanelHeaderProps) {
  return (
    <div {...props} className={classNames(styles.header, className)}>
      <HeadingGroup title={title} description={subtitle} headingLevel={2} size="medium" />
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
