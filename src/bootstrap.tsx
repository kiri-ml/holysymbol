import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App';
import { ConfirmProvider } from './app/confirmation';

export async function mountApplication() {
  let RootComponent: ComponentType = App;
  const previewRequested = import.meta.env.DEV && new URLSearchParams(window.location.search).has('responsive-preview');

  if (previewRequested) {
    RootComponent = (await import('./dev/ResponsivePreview')).ResponsivePreview;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Application root was not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ConfirmProvider>
        <RootComponent />
      </ConfirmProvider>
    </StrictMode>,
  );
}
