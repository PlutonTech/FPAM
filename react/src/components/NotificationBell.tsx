import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { clearAll, markAllRead, markRead, notificationLink, refreshNotifications, runAlertScan, useNotifications } from '../lib/notifications';
import { timeAgo } from '../lib/assets';

/** Starts the periodic alert scan for the signed-in user (2 s after load, then every 10 min). */
export function useAlertScan() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    refreshNotifications();
    const run = () => { runAlertScan(user).catch(() => {}); };
    const first = setTimeout(run, 2000);
    const every = setInterval(run, 600000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [user]);
}

export default function NotificationBell({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { list, read, unread } = useNotifications();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggle() {
    if (pos) { setPos(null); return; }
    const r = btn.current!.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  }

  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setPos(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [pos]);

  return (
    <>
      <button ref={btn} className={`notif-bell ${className}`} onClick={toggle} title="Notifications"
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={!!pos}>
        <i className="fa-solid fa-bell" />
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {pos && createPortal(
        <div ref={panel} className="notif-panel" style={{ top: pos.top, left: pos.left }} role="dialog" aria-label="Notifications">
          <div className="notif-hd">
            <div><strong>Notifications</strong>{unread > 0 && <span className="notif-count">{unread}</span>}</div>
            <div className="row" style={{ gap: 10 }}>
              {unread > 0 && <button className="notif-link" onClick={markAllRead}>Mark all read</button>}
              {list.length > 0 && <button className="notif-link muted" onClick={clearAll}>Clear all</button>}
            </div>
          </div>
          <div className="notif-list">
            {list.length === 0 ? (
              <div className="notif-empty"><i className="fa-solid fa-bell-slash" /> No notifications yet</div>
            ) : list.slice(0, 50).map(n => {
              const isRead = read.has(n.id);
              const to = notificationLink(n, user?.role);
              return (
                <button key={n.id} className={`notif-item${isRead ? '' : ' unread'}`}
                  onClick={() => { markRead(n.id); if (to) { setPos(null); navigate(to); } }}>
                  <span className="notif-icon" style={{ color: n.color, background: `${n.color}1f` }}><i className={`fa-solid ${n.icon}`} /></span>
                  <span className="notif-text">
                    <span className="notif-title">{n.title}</span>
                    <span className="notif-body">{n.body}</span>
                    <span className="notif-meta">{timeAgo(new Date(n.ts).toISOString())}{to && <span className="notif-go">Open →</span>}</span>
                  </span>
                  {!isRead && <span className="notif-dot" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
