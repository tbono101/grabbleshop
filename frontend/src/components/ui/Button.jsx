import Spinner from './Spinner.jsx';

const variants = {
  primary:   'bg-brand-accent hover:bg-red-600 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  outline:   'border border-gray-600 hover:border-gray-400 text-gray-200 hover:text-white',
  ghost:     'text-gray-300 hover:text-white hover:bg-gray-800',
  danger:    'bg-red-700 hover:bg-red-600 text-white',
  gold:      'bg-brand-gold hover:bg-yellow-400 text-gray-950 font-bold',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-accent/50
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
