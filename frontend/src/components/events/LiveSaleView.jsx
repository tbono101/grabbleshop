import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import Spinner from '../ui/Spinner.jsx';
import ListingCard from './ListingCard.jsx';
import { cents } from '../../utils/format.js';
import * as eventsApi from '../../services/eventsApi.js';
import * as claimsApi from '../../services/claimsApi.js';
import useAuthStore from '../../store/authStore.js';

function ClaimTimer({ expiresAt, onExpire }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setSecs(remaining);
      if (remaining === 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const pct = (secs / 300) * 100;
  const color = secs > 120 ? 'bg-green-500' : secs > 60 ? 'bg-yellow-500' : 'bg-brand-accent';

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-gray-400">Claim expires in</p>
      <p className={`text-3xl font-black ${secs < 60 ? 'text-brand-accent animate-pulse' : 'text-white'}`}>
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      </p>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function LiveSaleView({ event }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [myClaim, setMyClaim] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const activeListing = listings.find(l => l.status === 'active');
  const pendingListings = listings.filter(l => l.status === 'pending');
  const doneListings = listings.filter(l => ['sold', 'unsold', 'claimed'].includes(l.status));

  const refreshListings = useCallback(async () => {
    try {
      const res = await eventsApi.getEventListings(event.id);
      setListings(res.data.data);
    } catch {}
    setLoading(false);
  }, [event.id]);

  const refreshMyClaim = useCallback(async () => {
    if (!user) return;
    try {
      const res = await claimsApi.getMyClaims();
      const claim = res.data.data.find(c => c.event_id === event.id && c.status === 'pending');
      setMyClaim(claim || null);
    } catch {}
  }, [user, event.id]);

  useEffect(() => {
    refreshListings();
    refreshMyClaim();
    const id = setInterval(() => { refreshListings(); refreshMyClaim(); }, 3000);
    return () => clearInterval(id);
  }, [refreshListings, refreshMyClaim]);

  async function handleClaim(listing) {
    if (!user) return navigate('/login');
    if (myClaim) return setError('Release your current claim first.');
    setError('');
    setClaiming(true);
    try {
      await claimsApi.createClaim({ listingId: listing.id });
      await refreshMyClaim();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not claim item.');
    } finally {
      setClaiming(false);
    }
  }

  async function handleRelease() {
    if (!myClaim) return;
    try {
      await claimsApi.releaseClaim(myClaim.id);
      setMyClaim(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not release claim.');
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Current item — main stage */}
      <div className="lg:col-span-2 space-y-4">
        {activeListing ? (
          <div className="rounded-2xl border border-brand-accent bg-gray-900 overflow-hidden shadow-xl shadow-brand-accent/10">
            <div className="bg-brand-accent/10 px-4 py-2 flex items-center gap-2 border-b border-brand-accent/30">
              <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
              <span className="text-sm font-semibold text-brand-accent uppercase tracking-wide">Now Up For Grabs</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6">
              {/* Image */}
              <div className="aspect-square rounded-xl bg-gray-800 overflow-hidden">
                {activeListing.image_urls?.[0] ? (
                  <img src={activeListing.image_urls[0]} alt={activeListing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏷️</div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-col justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{activeListing.title}</h2>
                  {activeListing.description && (
                    <p className="text-sm text-gray-400 mt-2 leading-relaxed">{activeListing.description}</p>
                  )}
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Starting at</p>
                    <p className="text-3xl font-black text-brand-gold">{cents(activeListing.starting_price)}</p>
                  </div>
                </div>

                {/* Claim / timer area */}
                {myClaim && myClaim.listing_id === activeListing.id ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4">
                      <p className="text-sm font-semibold text-green-300 mb-3 text-center">You claimed this item!</p>
                      <ClaimTimer expiresAt={myClaim.expires_at} onExpire={refreshMyClaim} />
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleRelease}>
                      Release claim
                    </Button>
                  </div>
                ) : myClaim ? (
                  <div className="mt-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3">
                    <p className="text-sm text-yellow-300 text-center">You have another active claim</p>
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleRelease}>
                      Release it
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <Button variant="gold" size="xl" className="w-full" loading={claiming} onClick={() => handleClaim(activeListing)}>
                      GRAB IT!
                    </Button>
                    {!user && <p className="text-xs text-gray-500 text-center">Sign in to claim items</p>}
                  </div>
                )}

                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-gray-400 font-medium">Waiting for the next item…</p>
            <p className="text-sm text-gray-600 mt-1">The seller will activate a listing shortly</p>
          </div>
        )}

        {/* Past items */}
        {doneListings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Completed</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 opacity-60">
              {doneListings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </div>
        )}
      </div>

      {/* Coming up sidebar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Up Next ({pendingListings.length})
        </h3>
        <div className="space-y-3">
          {pendingListings.length === 0 && (
            <p className="text-sm text-gray-600 py-4 text-center">No more items queued</p>
          )}
          {pendingListings.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl bg-gray-900 border border-gray-800 p-3">
              <span className="text-xs text-gray-600 w-5 shrink-0 text-center font-mono">{i + 1}</span>
              <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                {l.image_urls?.[0]
                  ? <img src={l.image_urls[0]} alt={l.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-lg opacity-20">🏷️</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{l.title}</p>
                <p className="text-xs text-brand-gold">{cents(l.starting_price)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
