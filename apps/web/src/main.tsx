// Tokens + global base styles first so per-view CSS can override them.
import './tokens.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { EinstellungenProvider } from './lib/einstellungen';
import { registerServiceWorker } from './lib/push';
import { SessionProvider } from './lib/session';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <EinstellungenProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </EinstellungenProvider>
    </BrowserRouter>
  </StrictMode>,
);
