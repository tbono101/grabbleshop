export const cents = (n) => `$${(n / 100).toFixed(2)}`;

export const relativeTime = (iso) => {
  const diff = new Date(iso) - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);
  const past = diff < 0;

  if (mins < 1) return past ? 'just now' : 'starting soon';
  if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
  if (hrs < 24) return past ? `${hrs}h ago` : `in ${hrs}h`;
  return past ? `${days}d ago` : `in ${days}d`;
};

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const shortId = (id) => id?.slice(0, 8).toUpperCase();

export const statusLabel = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'LIVE',
  ended: 'Ended',
  cancelled: 'Cancelled',
  pending_payment: 'Awaiting Payment',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  refunded: 'Refunded',
};
