import { api } from './client';

// News for the public website, and the public gallery switch on assets.
const enc = encodeURIComponent;

export const NEWS_CATEGORIES = ['Press Release', 'Announcement', 'Project Update', 'Event', 'Notice'] as const;
export interface NewsItem {
  _id: string; title: string; slug: string; category: string; summary: string; body: string; byline: string;
  cover: { fileId: string | null; caption: string }; coverUrl: string | null;
  status: 'draft' | 'published'; publishedAt: string | null; inTicker: boolean; updatedAt: string; createdAt: string;
}

export const listNews = () => api<{ news: NewsItem[]; categories: string[] }>('/news/manage/all');
export const createNews = (body: Record<string, unknown>) => api<{ news: NewsItem }>('/news', { method: 'POST', body });
export const updateNews = (id: string, body: Record<string, unknown>) => api<{ news: NewsItem }>(`/news/${enc(id)}`, { method: 'PATCH', body });
export const deleteNews = (id: string) => api(`/news/${enc(id)}`, { method: 'DELETE' });
export const uploadCover = (id: string, file: File) => {
  const fd = new FormData();
  fd.append('photo', file);
  return api<{ news: NewsItem }>(`/news/${enc(id)}/cover`, { method: 'POST', body: fd });
};
export const removeCover = (id: string) => api<{ news: NewsItem }>(`/news/${enc(id)}/cover`, { method: 'DELETE' });

export const setGallery = (assetId: string, enabled: boolean, caption: string, hidden: boolean) =>
  api<{ publicGallery: { enabled: boolean; caption: string }; publicListing: { hidden: boolean } }>(`/gallery/assets/${enc(assetId)}`, { method: 'PATCH', body: { enabled, caption, hidden } });

/** Who can write news (mirrors routes/news_routes.js) and switch the gallery (routes/gallery_routes.js). */
export const NEWS_ROLES = ['System Admin', 'Supervisor'];
export const GALLERY_ROLES = ['System Admin', 'Supervisor', 'Sub-Head'];
