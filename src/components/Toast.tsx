import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; msg: string; kind: ToastKind }

const ToastContext = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setItems(list => [...list, { id, msg, kind }]);
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const icon = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <i className={`fa-solid ${icon[t.kind]}`} /> <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
