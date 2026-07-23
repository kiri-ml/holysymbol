import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../i18n';
import { NOTICE_DISMISS_MS } from './notice';
import { NoticePopup } from './NoticePopup';

describe('NoticePopup', () => {
  it('renders success notices as polite status messages', () => {
    const markup = renderToStaticMarkup(
      <NoticePopup notice={{ type: 'success', text: 'Characters refreshed.' }} onDismiss={() => undefined} />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('data-type="success"');
    expect(markup).toContain('Characters refreshed.');
  });

  it('renders error notices as assertive alerts', () => {
    const markup = renderToStaticMarkup(
      <NoticePopup notice={{ type: 'error', text: 'Refresh failed.' }} onDismiss={() => undefined} />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-type="error"');
    expect(markup).toContain('Refresh failed.');
  });

  it('uses a shorter dismissal duration for success', () => {
    expect(NOTICE_DISMISS_MS.success).toBe(3000);
    expect(NOTICE_DISMISS_MS.error).toBe(5000);
  });
});
