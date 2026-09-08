import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import 'katex/dist/katex.min.css';
import './index.css';

// Prevent iOS Safari / WebKit contextual popup (Paste, Copy, Look Up callout) on buttons and interactive UI
if (typeof document !== 'undefined') {
  document.addEventListener(
    'contextmenu',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInput =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          Boolean(target.closest('.selectable-text'));
        if (!isInput) {
          e.preventDefault();
          return false;
        }
      }
    },
    { passive: false }
  );

  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('.selectable-text'));
      if (!isInput) {
        e.preventDefault();
        return false;
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
