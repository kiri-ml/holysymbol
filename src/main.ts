import { applyTheme, readStoredTheme } from './app/theme';

function applyInitialTheme() {
  applyTheme(document.documentElement, readStoredTheme(window.localStorage));
}

function startApplication() {
  void import('./bootstrap')
    .then(({ mountApplication }) => mountApplication())
    .catch((error: unknown) => {
      console.error('Unable to start the application', error);
    });
}

applyInitialTheme();
startApplication();
