import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';
import { TextInput } from '../fields';
import { ControlGroup } from './ControlGroup';

describe('ControlGroup', () => {
  it('exposes joined orientation and width contracts', () => {
    const markup = renderToStaticMarkup(
      <ControlGroup width="full">
        <TextInput aria-label="Name" />
        <Button label="Add" />
      </ControlGroup>,
    );

    expect(markup).toContain('data-orientation="horizontal"');
    expect(markup).toContain('data-joined="true"');
    expect(markup).toContain('data-width="full"');
  });
});
