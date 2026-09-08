import { useToastStore } from '../store/toastStore.js';
import { CheckCircleIcon, ExclamationTriangleIcon } from './icons.js';

/**
 * Container global de toasts — montado uma única vez em `App.tsx`.
 * Use `showToast(message, variant)` (de `store/toastStore.ts`) de qualquer
 * lugar do app para exibir uma notificação, sem precisar de estado local.
 */
export default function ToastContainer() {
  const toasts  = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const isError = toast.variant === 'error';
        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-card-hover dark:bg-gray-900 ${
              isError
                ? 'border-red-200 dark:border-red-800/60'
                : 'border-brand-200 dark:border-brand-800/60'
            }`}
          >
            {isError
              ? <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              : <CheckCircleIcon className="h-4 w-4 shrink-0 text-lime-600 dark:text-lime-400" />
            }
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Fechar notificação"
              className="ml-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
