import { useState, useEffect } from 'react';
import OrderCard from '../components/orders/OrderCard.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import * as ordersApi from '../services/ordersApi.js';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending_payment', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ordersApi.listMyOrders({ status: status || undefined })
      .then(r => setOrders(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-5">My Orders</h1>

      <div className="flex gap-2 flex-wrap mb-6">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              status === t.value
                ? 'bg-brand-accent text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-400">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  );
}
