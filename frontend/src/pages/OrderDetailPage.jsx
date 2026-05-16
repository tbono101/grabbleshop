import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import * as ordersApi from '../services/ordersApi.js';
import * as paymentsApi from '../services/paymentsApi.js';
import { cents, shortDate, shortId } from '../utils/format.js';

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    ordersApi.getOrder(id)
      .then(r => setOrder(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    setPaying(true);
    try {
      const res = await paymentsApi.createCheckout(id);
      window.location.href = res.data.data.url;
    } catch (e) {
      setError(e.response?.data?.error || 'Payment failed. Please try again.');
      setPaying(false);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    try {
      const r = await ordersApi.cancelOrder(id);
      setOrder(r.data.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not cancel.');
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!order) return <div className="text-center py-20 text-gray-400">Order not found</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/orders" className="text-xs text-gray-500 hover:text-gray-300 mb-4 inline-block">← My Orders</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Order #{shortId(order.id)}</h1>
          <p className="text-xs text-gray-500 mt-1">{shortDate(order.created_at)} · {order.shop_name}</p>
        </div>
        <Badge status={order.status} />
      </div>

      {/* Items */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Items</h2>
        </div>
        {order.items?.map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
            <p className="text-sm text-white">{item.title}</p>
            <p className="text-sm text-gray-300 shrink-0 ml-4">{cents(item.price)} × {item.quantity}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 mb-4 space-y-2">
        <Row label="Subtotal" value={cents(order.subtotal)} />
        {order.shipping_amount > 0 && <Row label="Shipping" value={cents(order.shipping_amount)} />}
        {order.tax_amount > 0 && <Row label="Tax" value={cents(order.tax_amount)} />}
        <div className="border-t border-gray-800 pt-2 mt-2">
          <Row label="Total" value={cents(order.total)} bold />
        </div>
      </div>

      {/* Shipping address */}
      {order.line1 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Ship to</h2>
          <address className="not-italic text-sm text-gray-400 leading-relaxed">
            {order.buyer_first_name} {order.buyer_last_name}<br />
            {order.line1}{order.line2 ? `, ${order.line2}` : ''}<br />
            {order.city}, {order.state} {order.zip}
          </address>
        </div>
      )}

      {/* Shipment tracking */}
      {order.status === 'shipped' && (
        <div className="rounded-xl bg-purple-600/10 border border-purple-600/20 p-4 mb-4">
          <p className="text-sm font-semibold text-purple-300 mb-1">Your order is on the way!</p>
          <p className="text-xs text-purple-400/80">Check your email for tracking information.</p>
        </div>
      )}

      {order.status === 'delivered' && (
        <div className="rounded-xl bg-green-600/10 border border-green-600/20 p-4 mb-4">
          <p className="text-sm font-semibold text-green-300">Delivered!</p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-4">{error}</div>
      )}

      {/* Actions */}
      {order.status === 'pending_payment' && (
        <div className="flex gap-3">
          <Button size="lg" className="flex-1" loading={paying} onClick={handlePay}>
            Pay {cents(order.total)}
          </Button>
          <Button size="lg" variant="outline" loading={cancelLoading} onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? 'font-bold text-white' : 'text-gray-400'}>{label}</span>
      <span className={bold ? 'font-bold text-white' : 'text-gray-300'}>{value}</span>
    </div>
  );
}
