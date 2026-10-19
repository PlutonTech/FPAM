// Backend base URL. Override in .env.local, e.g. VITE_API_BASE=http://localhost:5000/api
export const API_BASE: string =
  import.meta.env.VITE_API_BASE || 'https://fpambacend.onrender.com/api';

// When the dashboard is served inside the public site (e.g. at /app/), the
// public site's own login page is used instead of the built-in one. Set
// VITE_LOGIN_URL (see .env.embed); leave it empty to use the React login.
export const LOGIN_URL: string = import.meta.env.VITE_LOGIN_URL || '';

/** Router-relative base, e.g. '/app' when built with --base=/app/. */
export const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Send the browser to the login screen (external page or the built-in route). */
export function goToLogin(navigate: (to: string) => void) {
  if (LOGIN_URL) window.location.assign(LOGIN_URL);
  else navigate('/login');
}
