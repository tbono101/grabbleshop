export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-300">{label}</label>
      )}
      <input
        className={`
          w-full rounded-lg bg-gray-800 border px-3 py-2.5 text-sm text-white
          placeholder:text-gray-500
          focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent
          transition-colors
          ${error ? 'border-red-500' : 'border-gray-700'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
