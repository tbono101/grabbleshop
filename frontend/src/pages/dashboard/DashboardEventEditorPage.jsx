import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import ListingFormModal from '../../components/events/ListingFormModal.jsx';
import * as eventsApi from '../../services/eventsApi.js';
import * as listingsApi from '../../services/listingsApi.js';
import * as sellersApi from '../../services/sellersApi.js';
import { cents } from '../../utils/format.js';

export default function DashboardEventEditorPage() {
  const { id } = useParams(); // undefined = new event
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [event, setEvent] = useState(null);
  const [listings, setListings] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [listingModal, setListingModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [activating, setActivating] = useState(null);

  const [form, setForm] = useState({
    title: '', description: '', scheduledAt: '', streamUrl: '', shippingPolicy: '',
  });

  async function refreshListings() {
    const res = await eventsApi.getEventListings(id);
    setListings(res.data.data);
  }

  useEffect(() => {
    async function load() {
      const storeRes = await sellersApi.getMyStore();
      setStore(storeRes.data.data);

      if (!isNew) {
        const [evtRes, lstRes] = await Promise.all([
          eventsApi.getEvent(id),
          eventsApi.getEventListings(id),
        ]);
        const e = evtRes.data.data;
        setEvent(e);
        setListings(lstRes.data.data);
        setForm({
          title: e.title,
          description: e.description || '',
          scheduledAt: e.scheduled_at ? e.scheduled_at.slice(0, 16) : '',
          streamUrl: e.stream_url || '',
          shippingPolicy: e.shipping_policy || '',
        });
      }
      setLoading(false);
    }
    load();
  }, [id, isNew]);

  async function saveEvent(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        scheduledAt: form.scheduledAt || undefined,
        streamUrl: form.streamUrl || undefined,
        shippingPolicy: form.shippingPolicy || undefined,
      };
      if (isNew) {
        const res = await eventsApi.createEvent(payload);
        navigate(`/dashboard/events/${res.data.data.id}`, { replace: true });
      } else {
        const res = await eventsApi.updateEvent(id, payload);
        setEvent(res.data.data);
      }
    } catch {}
    setSaving(false);
  }

  function openNewListing() {
    setEditingListing(null);
    setListingModal(true);
  }

  function openEditListing(l) {
    setEditingListing(l);
    setListingModal(true);
  }

  async function deleteListing(listingId) {
    if (!confirm('Delete this listing?')) return;
    await listingsApi.deleteListing(listingId);
    setListings(l => l.filter(x => x.id !== listingId));
  }

  async function activateListing(listingId) {
    setActivating(listingId);
    try {
      await listingsApi.activateListing(listingId);
      await refreshListings();
    } catch {}
    setActivating(null);
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const isLive = event?.status === 'live';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/events" className="text-gray-500 hover:text-gray-300">← Events</Link>
        {event && <Badge status={event.status} />}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">{isNew ? 'New Sale Event' : 'Edit Event'}</h1>
        {!isNew && (
          <Link to={`/dashboard/events/${id}/host`}>
            <Button variant={isLive ? 'primary' : 'secondary'}>
              {isLive ? '● Host Live Sale' : 'Open Host Console'}
            </Button>
          </Link>
        )}
      </div>

      {/* Event form */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <form onSubmit={saveEvent} className="space-y-4">
          <Input label="Event title *" placeholder='e.g. "Magic Kingdom Morning Haul"' value={form.title} onChange={set('title')} required />
          <div>
            <label className="text-sm font-medium text-gray-300">Description</label>
            <textarea
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 resize-none"
              rows={3}
              placeholder="What's in this sale? Any themes or special items?"
              value={form.description}
              onChange={set('description')}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Scheduled date & time" type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} />
            <Input label="Stream URL (TikTok, IG Live…)" placeholder="https://" value={form.streamUrl} onChange={set('streamUrl')} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300">Shipping policy</label>
            <textarea
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 resize-none"
              rows={2}
              placeholder="e.g. Ships within 3 business days via USPS Priority"
              value={form.shippingPolicy}
              onChange={set('shippingPolicy')}
            />
          </div>
          <Button type="submit" loading={saving}>{isNew ? 'Create Event' : 'Save Changes'}</Button>
        </form>
      </section>

      {/* Listings — only when event exists */}
      {!isNew && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              Listings <span className="text-gray-500 font-normal text-sm">({listings.length})</span>
            </h2>
            <Button size="sm" onClick={openNewListing}>+ Add Item</Button>
          </div>

          {listings.length === 0 ? (
            <div className="text-center py-10 rounded-2xl bg-gray-900 border border-gray-800">
              <p className="text-gray-500 mb-3">No items yet</p>
              <Button size="sm" variant="secondary" onClick={openNewListing}>Add your first item</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {listings.map(l => (
                <div key={l.id} className={`flex items-center gap-4 rounded-xl border p-4 ${l.status === 'active' ? 'border-brand-accent bg-brand-accent/5' : 'border-gray-800 bg-gray-900'}`}>
                  {/* Thumb */}
                  <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                    {l.image_urls?.[0]
                      ? <img src={l.image_urls[0]} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center text-xl opacity-20">🏷️</div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{l.title}</p>
                    <p className="text-xs text-brand-gold">
                      {cents(l.starting_price)}
                      {l.size && <span className="text-gray-500"> · Size {l.size}</span>}
                      {l.quantity > 1 && <span className="text-gray-500"> · Qty {l.quantity}</span>}
                    </p>
                  </div>

                  <Badge status={l.status} />

                  <div className="flex items-center gap-2 shrink-0">
                    {isLive && l.status === 'pending' && (
                      <Button size="xs" variant="primary" loading={activating === l.id} onClick={() => activateListing(l.id)}>
                        Set Live
                      </Button>
                    )}
                    {['pending', 'unsold'].includes(l.status) && (
                      <>
                        <Button size="xs" variant="secondary" onClick={() => openEditListing(l)}>Edit</Button>
                        <Button size="xs" variant="ghost" onClick={() => deleteListing(l.id)}>✕</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Shared item entry form */}
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
