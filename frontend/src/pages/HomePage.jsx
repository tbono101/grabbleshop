import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EventCard from '../components/events/EventCard.jsx';
import SellerCard from '../components/sellers/SellerCard.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import * as eventsApi from '../services/eventsApi.js';
import * as sellersApi from '../services/sellersApi.js';

export default function HomePage() {
  const [liveEvents, setLiveEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [liveRes, upcomingRes, sellerRes] = await Promise.all([
          eventsApi.listEvents({ status: 'live', limit: 4 }),
          eventsApi.listEvents({ status: 'scheduled', limit: 6 }),
          sellersApi.listSellers({ limit: 6 }),
        ]);
        setLiveEvents(liveRes.data.data);
        setUpcomingEvents(upcomingRes.data.data);
        setSellers(sellerRes.data.data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-light to-gray-900">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 25% 60%, #e94560 0%, transparent 50%), radial-gradient(circle at 75% 30%, #f5a623 0%, transparent 50%)',
        }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
            Disney Personal Shopping — Live
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-4">
            Grab Disney magic,<br />
            <span className="text-brand-accent">delivered to your door</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-8">
            Watch Disney park personal shoppers go live, claim exclusive park merchandise in real time, and have it shipped straight to you.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/events"
              className="bg-brand-accent hover:bg-red-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Watch Live Sales
            </Link>
            <Link
              to="/sellers"
              className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Browse Sellers
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-16">

        {loading && (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        )}

        {/* Live now */}
        {liveEvents.length > 0 && (
          <section>
            <SectionHeader
              title="Happening Now"
              badge="LIVE"
              href="/events?status=live"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveEvents.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcomingEvents.length > 0 && (
          <section>
            <SectionHeader title="Coming Up" href="/events?status=scheduled" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          </section>
        )}

        {/* How it works */}
        <section>
          <SectionHeader title="How It Works" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: '📺', title: 'Watch Live', desc: 'Tune in as a Disney personal shopper goes live from inside the park, walking you through available merchandise.' },
              { icon: '⚡', title: 'Claim Fast', desc: 'When an item goes active, hit GRAB IT! to claim it before anyone else. You have 5 minutes to confirm.' },
              { icon: '📦', title: 'Get It Shipped', desc: 'Pay securely through Stripe. Your item gets packed and shipped with full tracking via EasyPost.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl bg-gray-900 border border-gray-800 p-6 text-center">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-white font-bold mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Featured sellers */}
        {sellers.length > 0 && (
          <section>
            <SectionHeader title="Featured Sellers" href="/sellers" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sellers.map(s => <SellerCard key={s.id} seller={s} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, badge, href }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {badge && (
          <span className="bg-brand-accent text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
            {badge}
          </span>
        )}
      </div>
      {href && (
        <Link to={href} className="text-sm text-brand-accent hover:text-red-400 font-medium transition-colors">
          View all →
        </Link>
      )}
    </div>
  );
}
