import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterProgressFields } from './CharacterProgressFields';
import { clampLevel, normalizePercent } from './progressValues';

describe('CharacterProgressFields', () => {
  it('renders the level and percentage constraints', () => {
    const markup = renderToStaticMarkup(
      <CharacterProgressFields
        value={{ level: 120, expPercent: 68.5 }}
        onChange={() => undefined}
        levelLabel="Level"
        expLabel="EXP"
      />,
    );

    expect(markup).toContain('min="1"');
    expect(markup).toContain('max="200"');
    expect(markup).toContain('max="99.99"');
    expect(markup).toContain('step="0.01"');
  });

  it('normalizes level and EXP values to their supported ranges', () => {
    expect(clampLevel(1.4)).toBe(1);
    expect(clampLevel(199.6)).toBe(200);
    expect(clampLevel(201)).toBe(200);
    expect(normalizePercent(-1)).toBe(0);
    expect(normalizePercent(42.126)).toBe(42.13);
    expect(normalizePercent(100)).toBe(99.99);
  });
});
