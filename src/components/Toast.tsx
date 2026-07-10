import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastKind = 'info' | 'success' | 'warn' | 'error';

interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ToastCtx {
  toast: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<ToastMsg[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const add = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = ++idRef.current;
    setMsgs((prev) => [...prev, { id, text, kind }]);
    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      setMsgs((prev) => prev.filter((m) => m.id !== id));
    }, 3500);
    timersRef.current.set(id, timer);
  }, []);

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    setMsgs((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Cleanup all pending timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast: add }}>
      {children}
      {createPortal(
        <div className="toast-container" role="status" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={`toast toast-${m.kind}`} onClick={() => dismiss(m.id)}>
              <span className="toast-ico">
                {m.kind === 'success' ? '✓' : m.kind === 'error' ? '✗' : m.kind === 'warn' ? '⚠' : 'ℹ'}
              </span>
              <span className="toast-txt">{m.text}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
