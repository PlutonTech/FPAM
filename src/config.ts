// Backend base URL. Override in .env.local, e.g. VITE_API_BASE=http://localhost:5000/api
export const API_BASE: string =
  import.meta.env.VITE_API_BASE || 'https://fpambacend.onrender.com/api';
