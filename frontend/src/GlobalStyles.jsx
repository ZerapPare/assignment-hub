import { useEffect } from 'react';
import { C, FONT } from './theme';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Maitree:wght@400;500;600;700&display=swap';

const BASE_CSS = `
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: ${C.pageBg}; font-family: ${FONT}; color: ${C.ink}; }
  * { box-sizing: border-box; }
  a { color: ${C.navy}; text-decoration: none; }
  a:hover { color: ${C.navyDark}; }
  button { font-family: ${FONT}; }
  input { font-family: ${FONT}; }
`;

function ensureLink(id, attrs) {
  if (document.getElementById(id)) return;
  const el = document.createElement('link');
  el.id = id;
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  });
  document.head.appendChild(el);
}

function GlobalStyles() {
  useEffect(() => {
    ensureLink('ah-font-pre1', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    ensureLink('ah-font-pre2', {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: true,
    });
    ensureLink('ah-font-maitree', { rel: 'stylesheet', href: FONT_HREF });

    document.documentElement.lang = 'th';

    if (!document.getElementById('ah-base-css')) {
      const style = document.createElement('style');
      style.id = 'ah-base-css';
      style.textContent = BASE_CSS;
      document.head.appendChild(style);
    }
  }, []);

  return null;
}

export default GlobalStyles;
