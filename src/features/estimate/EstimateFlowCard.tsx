import type { ReactNode } from 'react';
import { classNames } from '../../ui/classNames';
import styles from './Estimate.module.css';

export function EstimateFlowCard({ step, title, labels, children, className }: {
  step: string;
  title: string;
  labels?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames(styles.flowCard, className)}>
      <div className={styles.flowTop}>
        <div className={styles.flowHeading}><span>{step}</span><strong>{title}</strong></div>
        {labels}
      </div>
      {children}
    </div>
  );
}
