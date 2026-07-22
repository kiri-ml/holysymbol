import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { IconButton } from './IconButton';

describe('Button labels', () => {
  it('uses a hidden label as the accessible name', () => {
    const markup = renderToStaticMarkup(
      <Button icon={<svg />} label="Dismiss" labelMode="hidden" />,
    );

    expect(markup).toContain('aria-label="Dismiss"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('exposes responsive labels and their collapse priority', () => {
    const markup = renderToStaticMarkup(
      <Button icon={<svg />} label="Export" labelMode="responsive" collapsePriority="high" />,
    );

    expect(markup).toContain('aria-label="Export"');
    expect(markup).toContain('data-responsive-button="high"');
    expect(markup).toContain('data-responsive-button-label="true"');
  });

  it('keeps a responsive label visible when there is no icon fallback', () => {
    const markup = renderToStaticMarkup(
      <Button label="Confirm" labelMode="responsive" />,
    );

    expect(markup).not.toContain('data-responsive-button=');
    expect(markup).not.toContain('aria-label=');
    expect(markup).toContain('Confirm');
  });
  it('owns icon-button accessibility and loading state', () => {
    const iconMarkup = renderToStaticMarkup(<IconButton icon={<svg />} aria-label="Delete" />);
    const loadingMarkup = renderToStaticMarkup(<Button icon={<svg />} label="Save" loading />);

    expect(iconMarkup).toContain('aria-label="Delete"');
    expect(loadingMarkup).toContain('aria-busy="true"');
    expect(loadingMarkup).toContain('disabled=""');
    expect(loadingMarkup).toContain('data-loading="true"');
  });

});
