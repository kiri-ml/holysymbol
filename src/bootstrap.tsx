import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';

export async function mountApplication() {
  let RootComponent: ComponentType;
  let ConfirmProvider: ComponentType<{ children: ReactNode }> | undefined;
  const previewRequested = import.meta.env.DEV && new URLSearchParams(window.location.search).has('responsive-preview');

  if (window.location.pathname === '/receipt-demo') {
    RootComponent = (await import('./features/receipt/RatioReceiptDemo')).RatioReceiptDemo;
  } else {
    const [appModule, confirmationModule] = await Promise.all([
      import('./App'),
      import('./app/confirmation'),
    ]);
    RootComponent = appModule.default;
    ConfirmProvider = confirmationModule.ConfirmProvider;
  }

  if (previewRequested) {
    RootComponent = (await import('./dev/ResponsivePreview')).ResponsivePreview;
    ConfirmProvider ??= (await import('./app/confirmation')).ConfirmProvider;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Application root was not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      {ConfirmProvider ? <ConfirmProvider><RootComponent /></ConfirmProvider> : <RootComponent />}
    </StrictMode>,
  );
}
