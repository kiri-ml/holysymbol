import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/index.css';
import App from './App';
import { ConfirmProvider } from './app/confirmation';

async function render() {
  let RootComponent: ComponentType = App;
  const previewRequested = import.meta.env.DEV && new URLSearchParams(window.location.search).has('responsive-preview');

  if (previewRequested) {
    RootComponent = (await import('./dev/ResponsivePreview')).ResponsivePreview;
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConfirmProvider>
        <RootComponent />
      </ConfirmProvider>
    </StrictMode>,
  );
}

void render();
