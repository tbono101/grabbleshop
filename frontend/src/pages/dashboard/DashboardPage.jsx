import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import * as sellersApi from '../../services/sellersApi.js';
import * as eventsApi from '../../services/eventsApi.js';
import * as ordersApi from '../../services/ordersApi.js';
import { cents, shortDate } from '../../utils/format.js';
import Badge from '../../components/ui/Badge.jsx';

export default function DashboardPage() {
  const [store, setStore] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const storeRes = await sellersApi.getMyStore();
        const seller = storeRes.data.data;
        setStore(seller);

        const [ordersRes, eventsRes, stripeRes] = await Promise.all([
          ordersApi.listSellerOrders({ limit: 5 }),
          eventsApi.listEvents({ sellerId: seller.id, limit: 5 }),
          sellersApi.stripeStatus(),
        ]);
        setRecentOrders(ordersRes.data.data);
        setUpcomingEvents(eventsRes.data.data);
        setStripeStatus(stripeRes.data.data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{store?.shop_name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Seller Dashboard</p>
        </div>
        <Link to="/dashboard/events/new">
          <Button>+ New Sale Event</Button>
        </Link>
      </div>

      {/* Stripe banner */}
      {!stripeStatus?.onboarded && (
        <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-yellow-300">Connect Stripe to get paid</p>
            <p className="text-sm text-yellow-400/80 mt-1">
              You need to complete Stripe onboarding before buyers can pay for your items.
            </p>
          </div>
          <Link to="/dashboard/onboarding">
            <Button variant="gold" size="sm">Set up payouts →</Button>
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: store?.total_sales ?? 0 },
          { label: 'Pending Orders', value: recentOrders.filter(o => o.status === 'pending_payment').length },
          { label: 'Active Events', value: upcomingEvents.filter(e => e.status === 'live').length },
          { label: 'Shop Name', value: store?.shop_name ?? '—', small: true },
        ].map(({ label, value, small }) => (
          <div key={label} className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`font-black text-white mt-1 ${small ? 'text-base' : 'text-3xl'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Recent Orders</h2>
            <Link to="/dashboard/orders" className="text-xs text-brand-accent hover:text-red-400">View all</Link>
          </div>
          <div className="space-y-2">
            {recentOrders.length === 0
              ? <p className="text-sm text-gray-600 py-4 text-center">No orders yet</p>
              : recentOrders.map(o => (
                <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 hover:border-gray-700 transition-colors">
                  <div>
                    <p className="text-xs text-gray-500 font-mono">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-white">{o.first_name} {o.last_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{cents(o.total)}</p>
                    <Badge status={o.status} className="mt-0.5" />
                  </div>
                </Link>
              ))
            }
          </div>
        </section>

        {/* Events */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Your Events</h2>
            <Link to="/dashboard/events" className="text-xs text-brand-accent hover:text-red-400">Manage</Link>
          </div>
          <div className="space-y-2">
            {upcomingEvents.length === 0
              ? <p className="text-sm text-gray-600 py-4 text-center">No events yet —{' '}
                  <Link to="/dashboard/events/new" className="text-brand-accent">create one</Link>
                </p>
              : upcomingEvents.map(e => (
                <Link key={e.id} to={`/dashboard/events/${e.id}`} className="flex items-center gap-3 rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 hover:border-gray-700 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{e.title}</p>
                    {e.scheduled_at && <p className="text-xs text-gray-500 mt-0.5">{shortDate(e.scheduled_at)}</p>}
                  </div>
                  <Badge status={e.status} />
                </Link>
              ))
            }
          </div>
        </section>
      </div>
    </div>
  );
}
