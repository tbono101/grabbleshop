import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import * as ordersApi from '../../services/ordersApi.js';
import { cents, shortDate, shortId } from '../../utils/format.js';

const NEXT_STATUS = {
  paid: 'processing',
  processing: 'shipped',
  shipped: 'delivered',
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending_payment', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
];

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await ordersApi.listSellerOrders({ status: status || undefined, limit: 50 });
      setOrders(res.data.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [status]);

  async function advance(orderId, newStatus) {
    setAdvancing(orderId);
    try {
      await ordersApi.updateOrderStatus(orderId, { status: newStatus });
      await load();
    } catch {}
    setAdvancing(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-5">Orders</h1>

      <div className="flex gap-2 flex-wrap mb-6">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              status === t.value ? 'bg-brand-accent text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-gray-900 border border-gray-800">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-400">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">#{shortId(order.id)}</span>
                    <Badge status={order.status} />
                  </div>
                  <p className="text-white font-medium">{order.first_name} {order.last_name}</p>
                  <p className="text-xs text-gray-500">{order.email}</p>
                  <p className="text-xs text-gray-500 mt-1">{shortDate(order.created_at)} · {order.item_count} item{order.item_count !== 1 ? 's' : ''}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-lg font-bold text-white">{cents(order.total)}</p>
                  <Link to={`/orders/${order.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                  {NEXT_STATUS[order.status] && (
                    <Button
                      size="sm"
                      loading={advancing === order.id}
                      onClick={() => advance(order.id, NEXT_STATUS[order.status])}
                    >
                      Mark {NEXT_STATUS[order.status]}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
