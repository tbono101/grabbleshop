const styles = {
  live:            'bg-brand-accent text-white animate-pulse',
  scheduled:       'bg-blue-600 text-white',
  draft:           'bg-gray-600 text-gray-200',
  ended:           'bg-gray-700 text-gray-400',
  cancelled:       'bg-gray-800 text-gray-500',
  pending_payment: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
  paid:            'bg-green-600/20 text-green-400 border border-green-600/30',
  processing:      'bg-blue-600/20 text-blue-400 border border-blue-600/30',
  shipped:         'bg-purple-600/20 text-purple-400 border border-purple-600/30',
  delivered:       'bg-green-600/20 text-green-300 border border-green-600/30',
  refunded:        'bg-red-600/20 text-red-400 border border-red-600/30',
  new:             'bg-brand-gold/20 text-brand-gold border border-brand-gold/30',
  active:          'bg-green-500/20 text-green-400 border border-green-500/30',
  claimed:         'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  sold:            'bg-gray-600/20 text-gray-400 border border-gray-500/30',
  pending:         'bg-gray-600/20 text-gray-300 border border-gray-600/30',
};

const labels = {
  live: 'LIVE', scheduled: 'Scheduled', draft: 'Draft', ended: 'Ended',
  cancelled: 'Cancelled', pending_payment: 'Awaiting Payment', paid: 'Paid',
  processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered',
  refunded: 'Refunded', new: 'New', active: 'Active', claimed: 'Claimed',
  sold: 'Sold', pending: 'Pending',
};

export default function Badge({ status, children, className = '' }) {
  const style = styles[status] || 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style} ${className}`}>
      {status === 'live' && <span className="mr-1 w-1.5 h-1.5 rounded-full bg-white inline-block" />}
      {children ?? labels[status] ?? status}
    </span>
  );
}
