import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import ListingFormModal from '../../components/events/ListingFormModal.jsx';
import * as eventsApi from '../../services/eventsApi.js';
import * as listingsApi from '../../services/listingsApi.js';
import * as claimsApi from '../../services/claimsApi.js';
import { cents, relativeTime } from '../../utils/format.js';

export default function DashboardHostPage() {
  const { id } = useParams();

  const [event, setEvent] = useState(null);
  const [listings, setListings] = useState([]);
  const [claims, setClaims] = useState([]);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);          // generic per-action lock key
  const [listingModal, setListingModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [error, setError] = useState('');

  const eventRef = useRef(null);
  eventRef.current = event;

  const refreshListings = useCallback(async () => {
    const res = await eventsApi.getEventListings(id);
    setListings(res.data.data);
  }, [id]);

  const refreshClaims = useCallback(async () => {
    // Only the seller can read event claims; ignore errors silently.
    try {
      const res = await claimsApi.getEventClaims(id);
      setClaims(res.data.data);
    } catch {}
  }, [id]);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await claimsApi.getEventInvoices(id);
      setInvoices(res.data.data);
    } catch {}
  }, [id]);

  const refreshEvent = useCallback(async () => {
    const res = await eventsApi.getEvent(id);
    setEvent(res.data.data);
    return res.data.data;
  }, [id]);

  useEffect(() => {
    (async () => {
      const e = await refreshEvent();
      await Promise.all([refreshListings(), refreshClaims()]);
      if (e.status === 'ended') await loadInvoices();
      setLoading(false);
    })();
  }, [refreshEvent, refreshListings, refreshClaims, loadInvoices]);

  // Live polling while the sale is running.
  useEffect(() => {
    const tick = () => {
      const st = eventRef.current?.status;
      if (st === 'live') { refreshListings(); refreshClaims(); }
    };
    const interval = setInterval(tick, 3000);
    return () => clearInterval(interval);
  }, [refreshListings, refreshClaims]);

  async function run(key, fn) {
    setBusy(key);
    setError('');
    try { await fn(); }
    catch (err) { setError(err.response?.data?.error || 'Something went wrong.'); }
    setBusy(null);
  }

  const goLive   = () => run('golive', async () => { await eventsApi.startEvent(id); await refreshEvent(); await refreshListings(); });
  const endSale  = () => run('end', async () => {
    await eventsApi.endEvent(id);
    await refreshEvent();
    await Promise.all([refreshListings(), refreshClaims()]);
    await loadInvoices();
  });

  const setLive    = (lid) => run('act-' + lid, async () => { await listingsApi.activateListing(lid); await Promise.all([refreshListings(), refreshClaims()]); });
  const putBack    = (lid) => run('deact-' + lid, async () => { await listingsApi.deactivateListing(lid); await refreshListings(); });
  const markSold   = (claimId) => run('sold-' + claimId, async () => { await claimsApi.confirmClaim(claimId, {}); await Promise.all([refreshListings(), refreshClaims()]); });
  const releaseClaim = (claimId) => run('rel-' + claimId, async () => { await claimsApi.releaseClaim(claimId); await Promise.all([refreshListings(), refreshClaims()]); });

  async function deleteListing(lid) {
    if (!confirm('Delete this item?')) return;
    await run('del-' + lid, async () => {
      await listingsApi.deleteListing(lid);
      await refreshListings();
    });
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!event) return (
    <div className="text-center py-20">
      <p className="text-gray-400">Event not found.</p>
      <Link to="/dashboard/events" className="text-brand-accent text-sm mt-2 inline-block">← Back to events</Link>
    </div>
  );

  const isLive  = event.status === 'live';
  const isEnded = ['ended', 'cancelled'].includes(event.status);
  const canStart = ['draft', 'scheduled'].includes(event.status);

  const pendingClaimByListing = {};
  for (const c of claims) {
    if (c.status === 'pending') pendingClaimByListing[c.listing_id] = c;
  }

  const currentListing =
    listings.find(l => l.status === 'claimed') ||
    listings.find(l => l.status === 'active') || null;
  const currentClaim = currentListing ? pendingClaimByListing[currentListing.id] : null;

  const queue   = listings.filter(l => l.status === 'pending');
  const done    = listings.filter(l => ['sold', 'unsold'].includes(l.status));
  const pendingClaims = claims.filter(c => c.status === 'pending');

  function openNewListing() { setEditingListing(null); setListingModal(true); }
  function openEditListing(l) { setEditingListing(l); setListingModal(true); }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/dashboard/events/${id}`} className="text-gray-500 hover:text-gray-300 shrink-0">← Edit</Link>
          <h1 className="text-xl font-bold text-white truncate">{event.title}</h1>
          <Badge status={event.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/events/${id}`} target="_blank" className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
            Public page →
          </Link>
          {canStart && (
            <Button variant="primary" loading={busy === 'golive'} onClick={goLive}>● Go Live</Button>
          )}
          {isLive && (
            <Button variant="danger" loading={busy === 'end'} onClick={() => { if (confirm('End this sale? All outstanding grabs will be confirmed as sales and invoiced.')) endSale(); }}>
              End Sale
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Ended → invoice summary */}
      {isEnded && (
        <InvoiceSummary invoices={invoices} onReload={loadInvoices} />
      )}

      {/* Live / pre-live control grid */}
      {!isEnded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main stage */}
          <div className="lg:col-span-2 space-y-5">
            {/* Current item */}
            <section className="rounded-2xl border border-brand-accent/40 bg-gray-900 overflow-hidden">
              <div className="bg-brand-accent/10 px-4 py-2 flex items-center gap-2 border-b border-brand-accent/20">
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-brand-accent animate-pulse' : 'bg-gray-600'}`} />
                <span className="text-sm font-semibold text-brand-accent uppercase tracking-wide">On The Block</span>
              </div>

              {currentListing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5">
                  <div className="aspect-square rounded-xl bg-gray-800 overflow-hidden">
                    {currentListing.image_urls?.[0]
                      ? <img src={currentListing.image_urls[0]} alt={currentListing.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🏷️</div>}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Badge status={currentListing.status} />
                      {currentListing.size && <span className="text-xs text-gray-400">Size {currentListing.size}</span>}
                    </div>
                    <h2 className="text-lg font-bold text-white mt-2">{currentListing.title}</h2>
                    <p className="text-2xl font-black text-brand-gold mt-1">{cents(currentListing.starting_price)}</p>

                    {currentClaim ? (
                      <div className="mt-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3">
                        <p className="text-xs text-yellow-300/80 uppercase tracking-wider">Claimed by</p>
                        <p className="text-sm font-semibold text-white">{currentClaim.first_name} {currentClaim.last_name}</p>
                        <p className="text-xs text-gray-400">{currentClaim.email}</p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="gold" className="flex-1" loading={busy === 'sold-' + currentClaim.id} onClick={() => markSold(currentClaim.id)}>
                            Mark Sold
                          </Button>
                          <Button size="sm" variant="outline" loading={busy === 'rel-' + currentClaim.id} onClick={() => releaseClaim(currentClaim.id)}>
                            Release
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-auto pt-4">
                        <p className="text-sm text-gray-400 mb-3">Waiting for a shopper to grab it…</p>
                        <Button size="sm" variant="outline" className="w-full" loading={busy === 'deact-' + currentListing.id} onClick={() => putBack(currentListing.id)}>
                          Pull from block
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center">
                  <p className="text-4xl mb-2">🎤</p>
                  <p className="text-gray-400 font-medium">{isLive ? 'Nothing on the block' : 'Sale not started'}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {isLive ? 'Set an item live from the queue to start taking grabs.' : 'Press “Go Live” when you’re ready to start.'}
                  </p>
                </div>
              )}
            </section>

            {/* Sold / completed */}
            {done.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Completed ({done.length})</h3>
                <div className="space-y-2">
                  {done.map(l => {
                    const soldClaim = claims.find(c => c.listing_id === l.id && c.status === 'confirmed');
                    return (
                      <div key={l.id} className="flex items-center gap-3 rounded-xl bg-gray-900 border border-gray-800 px-4 py-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                          {l.image_urls?.[0]
                            ? <img src={l.image_urls[0]} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center opacity-20">🏷️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{l.title}</p>
                          {soldClaim && <p className="text-xs text-gray-500">→ {soldClaim.first_name} {soldClaim.last_name}</p>}
                        </div>
                        <span className="text-sm font-semibold text-brand-gold">{cents(l.starting_price)}</span>
                        <Badge status={l.status} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: queue + add */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Up Next ({queue.length})</h3>
              <Button size="xs" onClick={openNewListing}>+ Add Item</Button>
            </div>

            <div className="space-y-2">
              {queue.length === 0 && (
                <p className="text-sm text-gray-600 py-4 text-center rounded-xl border border-dashed border-gray-800">
                  No items queued
                </p>
              )}
              {queue.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl bg-gray-900 border border-gray-800 p-3">
                  <span className="text-xs text-gray-600 w-4 shrink-0 text-center font-mono">{i + 1}</span>
                  <div className="w-11 h-11 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                    {l.image_urls?.[0]
                      ? <img src={l.image_urls[0]} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center opacity-20">🏷️</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{l.title}</p>
                    <p className="text-xs text-brand-gold">
                      {cents(l.starting_price)}
                      {l.size && <span className="text-gray-500"> · {l.size}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {isLive ? (
                      <Button size="xs" variant="primary" loading={busy === 'act-' + l.id} onClick={() => setLive(l.id)}>Set Live</Button>
                    ) : (
                      <Button size="xs" variant="secondary" onClick={() => openEditListing(l)}>Edit</Button>
                    )}
                    <button onClick={() => deleteListing(l.id)} className="text-xs text-gray-600 hover:text-red-400">remove</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Incoming claims feed */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Incoming Grabs ({pendingClaims.length})
              </h3>
              <div className="space-y-2">
                {pendingClaims.length === 0 && (
                  <p className="text-sm text-gray-600 py-3 text-center">No active grabs</p>
                )}
                {pendingClaims.map(c => (
                  <div key={c.id} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
                    <p className="text-sm text-white font-medium truncate">{c.listing_title}</p>
                    <p className="text-xs text-gray-400">{c.first_name} {c.last_name} · {cents(c.price)}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">grabbed {relativeTime(c.created_at)}</p>
                    <div className="flex gap-2 mt-2">
                      <Button size="xs" variant="gold" className="flex-1" loading={busy === 'sold-' + c.id} onClick={() => markSold(c.id)}>Mark Sold</Button>
                      <Button size="xs" variant="outline" loading={busy === 'rel-' + c.id} onClick={() => releaseClaim(c.id)}>Release</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ListingFormModal
        isOpen={listingModal}
        onClose={() => setListingModal(false)}
        eventId={id}
        listing={editingListing}
        onChange={refreshListings}
      />
    </div>
  );
}

function InvoiceSummary({ invoices, onReload }) {
  if (!invoices) {
    return (
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
        <p className="text-gray-400 mb-3">Generating invoices…</p>
        <Button size="sm" variant="secondary" onClick={onReload}>Reload</Button>
      </section>
    );
  }

  const { invoices: list, grandTotal, itemCount, buyerCount } = invoices;

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Sale Invoices</h2>
          <p className="text-xs text-gray-500 mt-0.5">{buyerCount} shopper{buyerCount === 1 ? '' : 's'} · {itemCount} item{itemCount === 1 ? '' : 's'} sold</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Sale total</p>
          <p className="text-2xl font-black text-brand-gold">{cents(grandTotal)}</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-4xl mb-2">🧾</p>
          <p className="text-gray-400">No confirmed sales for this event.</p>
          <p className="text-sm text-gray-600 mt-1">Items must be marked sold during the sale to appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {list.map(inv => (
            <div key={inv.buyer_id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{inv.name}</p>
                  <p className="text-xs text-gray-500">{inv.email}</p>
                </div>
                <p className="text-lg font-black text-white">{cents(inv.total)}</p>
              </div>
              <div className="space-y-1.5">
                {inv.items.map((it, idx) => (
                  <div key={it.listing_id + '-' + idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate pr-3">
                      {it.title}
                      {it.size && <span className="text-gray-500"> · {it.size}</span>}
                    </span>
                    <span className="text-gray-400 shrink-0">{cents(it.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
