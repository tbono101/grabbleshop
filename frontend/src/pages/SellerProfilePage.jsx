import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import EventCard from '../components/events/EventCard.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import * as sellersApi from '../services/sellersApi.js';
import * as eventsApi from '../services/eventsApi.js';
import useAuthStore from '../store/authStore.js';

export default function SellerProfilePage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [seller, setSeller] = useState(null);
  const [events, setEvents] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('events');

  useEffect(() => {
    Promise.all([
      sellersApi.getSeller(id),
      eventsApi.listEvents({ sellerId: id, limit: 12 }),
      sellersApi.getSellerReviews(id),
    ])
      .then(([sRes, eRes, rRes]) => {
        setSeller(sRes.data.data);
        setEvents(eRes.data.data);
        setReviews(rRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFollow() {
    if (!user) return;
    try {
      if (following) { await sellersApi.unfollowSeller(id); setFollowing(false); }
      else { await sellersApi.followSeller(id); setFollowing(true); }
    } catch {}
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  if (!seller) return <div className="text-center py-20 text-gray-400">Seller not found</div>;

  const initials = `${seller.first_name?.[0] || ''}${seller.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Banner */}
      <div className="h-40 sm:h-56 bg-gradient-to-r from-brand via-brand-light to-gray-900 relative overflow-hidden">
        {seller.banner_url && <img src={seller.banner_url} alt="" className="w-full h-full object-cover opacity-60" />}
      </div>

      <div className="px-4 sm:px-6">
        {/* Profile row */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 mb-6">
          <div className="relative">
            {seller.avatar_url ? (
              <img src={seller.avatar_url} className="w-24 h-24 rounded-2xl border-4 border-gray-950 object-cover" alt={seller.shop_name} />
            ) : (
              <div className="w-24 h-24 rounded-2xl border-4 border-gray-950 bg-brand-accent flex items-center justify-center text-3xl font-black text-white">
                {initials || '?'}
              </div>
            )}
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-2xl font-black text-white">{seller.shop_name}</h1>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-400">
              <span>{seller.total_sales} sales</span>
              {seller.count > 0 && <span>★ {Number(seller.avg_rating).toFixed(1)} ({seller.count} reviews)</span>}
              {seller.follower_count > 0 && <span>{seller.follower_count} followers</span>}
            </div>
            {seller.instagram_handle && (
              <a href={`https://instagram.com/${seller.instagram_handle}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 mt-1 inline-block">
                @{seller.instagram_handle}
              </a>
            )}
          </div>
          {user && user.id !== seller.user_id && (
            <Button
              variant={following ? 'outline' : 'secondary'}
              size="sm"
              onClick={toggleFollow}
            >
              {following ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>

        {seller.bio && (
          <p className="text-gray-400 text-sm leading-relaxed max-w-2xl mb-6">{seller.bio}</p>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800 mb-6">
          {['events', 'reviews'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-brand-accent text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t} {t === 'events' && `(${events.length})`}
              {t === 'reviews' && reviews.length > 0 && ` (${reviews.length})`}
            </button>
          ))}
        </div>

        {tab === 'events' && (
          events.length === 0
            ? <p className="text-gray-500 py-10 text-center">No events yet</p>
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                {events.map(e => <EventCard key={e.id} event={e} />)}
              </div>
        )}

        {tab === 'reviews' && (
          reviews.length === 0
            ? <p className="text-gray-500 py-10 text-center">No reviews yet</p>
            : <div className="space-y-3 pb-8">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                        {r.first_name?.[0]}
                      </div>
                      <span className="text-sm font-medium text-white">{r.first_name} {r.last_name?.[0]}.</span>
                      <span className="ml-auto text-brand-gold text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                    {r.body && <p className="text-sm text-gray-400 leading-relaxed">{r.body}</p>}
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  );
}
