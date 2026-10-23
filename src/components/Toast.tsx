'use client';

interface ToastProps {
  message: string;
  show: boolean;
}

// 항상 렌더링하고 CSS의 .show 클래스로 나타남/사라짐 애니메이션을 처리
export default function Toast({ message, show }: ToastProps) {
  return (
    <div className={`toast ${show ? 'show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
