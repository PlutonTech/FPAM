import { LEGACY_DASHBOARD_URL } from '../config';

export default function PlaceholderPage({ title, legacyPage }: { title: string; legacyPage: string }) {
  return (
    <div className="page">
      <header className="page-header"><h1 className="page-title">{title}</h1></header>
      <div className="card empty-state">
        <div className="empty-icon"><i className="fa-solid fa-person-digging" /></div>
        <div className="empty-title">Not yet ported to React</div>
        <div className="empty-sub">This page still lives in the existing dashboard.</div>
        <a className="btn btn-secondary" href={`${LEGACY_DASHBOARD_URL}/${legacyPage}`} target="_blank" rel="noreferrer">
          <i className="fa-solid fa-arrow-up-right-from-square" /> Open legacy {title}
        </a>
      </div>
    </div>
  );
}
