import type { HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../classNames';
import styles from './HeadingGroup.module.css';

export type HeadingGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  size?: 'small' | 'medium' | 'large';
  headingLevel?: 1 | 2 | 3 | 4;
  titleId?: string;
};

export function HeadingGroup({ eyebrow, title, description, size = 'medium', headingLevel = 2, titleId, className, ...props }: HeadingGroupProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4';
  return (
    <div {...props} className={classNames(styles.root, className)} data-size={size}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <Heading id={titleId} className={styles.title}>{title}</Heading>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  );
}
