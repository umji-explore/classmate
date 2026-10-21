'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  show: boolean;
}

export default function Toast({ message, show }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!visible && !show) return null;

  return (
    <div
      className={`toast ${show ? 'show' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
