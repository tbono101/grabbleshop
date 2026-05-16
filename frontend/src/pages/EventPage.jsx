import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Badge from '../components/ui/Badge.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import LiveSaleView from '../components/events/LiveSaleView.jsx';
import ListingCard from '../components/events/ListingCard.jsx';
import * as eventsApi from '../services/eventsApi.js';
import { shortDate, relativeTime } from '../utils/format.js';

export default function EventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      eventsApi.getEvent(id),
      eventsApi.getEventListings(id),
    ])
      .then(([evtRes, lstRes]) => {
        setEvent(evtRes.data.data);
        setListings(lstRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>
  );

  if (!event) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">🔍</p>
      <p className="text-gray-400">Event not found</p>
      <Link to="/events" className="text-brand-accent text-sm mt-2 inline-block">← Back to events</Link>
    </div>
  );

  const isLive = event.status === 'live';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

      {/* Event header */}
      <div className="mb-6">
        <Link to="/events" className="text-xs text-gray-500 hover:text-gray-300 mb-3 inline-block">
          ← All Events
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge status={event.status} />
              {event.scheduled_at && !isLive && (
                <span className="text-xs text-gray-500">{relativeTime(event.scheduled_at)}</span>
              )}
              {event.started_at && isLive && (
                <span className="text-xs text-gray-500">Started {relativeTime(event.started_at)}</span>
              )}
            </div>
            <h1 className="text-2xl font-black text-white">{event.title}</h1>
            {event.description && (
              <p className="text-sm text-gray-400 mt-2 leading-relaxed max-w-2xl">{event.description}</p>
            )}

            {/* Seller */}
            <Link
              to={`/sellers/${event.seller_id}`}
              className="inline-flex items-center gap-2 mt-3 hover:opacity-80 transition-opacity"
            >
              {event.seller_avatar ? (
                <img src={event.seller_avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center text-xs font-bold text-white">
                  {event.shop_name?.[0]}
                </div>
              )}
              <span className="text-sm text-gray-300 font-medium">{event.shop_name}</span>
            </Link>
          </div>

          {/* Stream link */}
          {event.stream_url && isLive && (
            <a
              href={event.stream_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Watch Stream
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      {isLive ? (
        <LiveSaleView event={event} />
      ) : (
        <>
          {event.status === 'scheduled' && (
            <div className="mb-6 rounded-xl bg-blue-600/10 border border-blue-600/20 p-4 text-center">
              <p className="text-sm text-blue-300 font-medium">
                This sale is scheduled for {shortDate(event.scheduled_at)} — check back then!
              </p>
            </div>
          )}

          {listings.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">No listings added yet.</p>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">{listings.length} Items</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {listings.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
