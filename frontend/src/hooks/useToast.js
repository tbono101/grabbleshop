import { useState, useCallback } from 'react';

let id = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const key = ++id;
    setToasts(t => [...t, { id: key, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== key)), duration);
  }, []);

  const dismiss = useCallback((key) => setToasts(t => t.filter(x => x.id !== key)), []);

  return { toasts, toast, dismiss };
}
