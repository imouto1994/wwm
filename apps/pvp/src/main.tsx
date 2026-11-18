import App from '@/App';
import { I18nProvider } from '@/hooks/useI18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>
  );
}
