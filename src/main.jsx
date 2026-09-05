import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import { I18nProvider } from './i18n.jsx';
import './styles.css';
import './experience.css';

const app = (
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);
const root = document.getElementById('root');
if (root.dataset.rendered) hydrateRoot(root, app);
else createRoot(root).render(app);
