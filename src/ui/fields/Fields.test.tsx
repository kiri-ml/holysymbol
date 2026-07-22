import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('field accessibility', () => {
  it('connects labels, descriptions, and errors to the control', () => {
    const markup = renderToStaticMarkup(
      <TextField
        id="buyer-ign"
        label="Buyer IGN"
        value="PreviewMage"
        description="MapleLegends character name"
        error="Character was not found"
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain('for="buyer-ign"');
    expect(markup).toContain('id="buyer-ign"');
    expect(markup).toContain('aria-describedby="buyer-ign-description buyer-ign-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="buyer-ign-description"');
    expect(markup).toContain('id="buyer-ign-error"');
  });
});
