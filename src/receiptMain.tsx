import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme, readStoredTheme } from './app/theme';
import { RatioReceiptPage } from './features/receipt/RatioReceiptPage';
import './i18n';

applyTheme(document.documentElement, readStoredTheme(window.localStorage));

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Receipt application root was not found');

createRoot(rootElement).render(
  <StrictMode>
    <RatioReceiptPage />
  </StrictMode>,
);
