const icons = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

const styles = {
  success: 'border-green-500/30 bg-green-500/10 text-green-300',
  error:   'border-red-500/30 bg-red-500/10 text-red-300',
  info:    'border-blue-500/30 bg-blue-500/10 text-blue-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
};

export default function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl pointer-events-auto transition-all ${styles[t.type] || styles.info}`}
        >
          <span className="text-lg leading-none mt-0.5">{icons[t.type] || icons.info}</span>
          <p className="flex-1 text-sm leading-snug">{t.message}</p>
          <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
        </div>
      ))}
    </div>
  );
}
