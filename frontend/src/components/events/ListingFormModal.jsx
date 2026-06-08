import { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import * as listingsApi from '../../services/listingsApi.js';

const EMPTY = {
  title: '', description: '', category: '', condition: 'new',
  startingPrice: '', buyNowPrice: '', quantity: 1, size: '',
};

/**
 * Shared add/edit item form with photo upload, used by both the event editor
 * and the live host console.
 *
 * Props:
 *   isOpen, onClose     — modal control
 *   eventId             — the event this listing belongs to
 *   listing             — existing listing to edit (null = create new)
 *   onChange            — called after any successful create/update/photo change
 */
export default function ListingFormModal({ isOpen, onClose, eventId, listing, onChange }) {
  const [form, setForm] = useState(EMPTY);
  const [current, setCurrent] = useState(null); // persisted listing (with images)
  const [saving, setSaving] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (listing) {
      setCurrent(listing);
      setForm({
        title: listing.title,
        description: listing.description || '',
        category: listing.category || '',
        condition: listing.condition || 'new',
        startingPrice: (listing.starting_price / 100).toFixed(2),
        buyNowPrice: listing.buy_now_price ? (listing.buy_now_price / 100).toFixed(2) : '',
        quantity: listing.quantity ?? 1,
        size: listing.size || '',
      });
    } else {
      setCurrent(null);
      setForm(EMPTY);
    }
  }, [isOpen, listing]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function refreshCurrent(id) {
    const res = await listingsApi.getListing(id);
    setCurrent(res.data.data);
    onChange?.();
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        condition: form.condition,
        startingPrice: parseFloat(form.startingPrice),
        buyNowPrice: form.buyNowPrice ? parseFloat(form.buyNowPrice) : undefined,
        quantity: Number(form.quantity) || 1,
        size: form.size || undefined,
      };
      if (current?.id) {
        await listingsApi.updateListing(current.id, payload);
        await refreshCurrent(current.id);
      } else {
        const created = (await listingsApi.createListing({ ...payload, eventId })).data.data;
        // Switch into edit mode so photos can be attached without closing.
        await refreshCurrent(created.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save item.');
    }
    setSaving(false);
  }

  async function handleUpload(e) {
    const files = e.target.files;
    if (!files?.length || !current) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('images', f);
      await listingsApi.uploadImages(current.id, fd);
      await refreshCurrent(current.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Photo upload failed.');
    }
    setUploading(false);
    e.target.value = '';
  }

  async function handleDeleteImage(imageId) {
    if (!current) return;
    try {
      await listingsApi.deleteImage(current.id, imageId);
      await refreshCurrent(current.id);
    } catch {}
  }

  async function handleGenerateDesc() {
    if (!current) return;
    setGeneratingDesc(true);
    try {
      const res = await listingsApi.generateDescription(current.id);
      setForm(f => ({ ...f, description: res.data.data.description }));
    } catch {}
    setGeneratingDesc(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={current ? 'Edit Item' : 'Add Item'} maxWidth="max-w-xl">
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Title *"
          placeholder='e.g. "Haunted Mansion Spirit Jersey"'
          value={form.title}
          onChange={set('title')}
          required
        />

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-300">Description</label>
            <textarea
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 resize-none"
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Describe the item…"
            />
          </div>
          {current && (
            <Button type="button" size="sm" variant="secondary" loading={generatingDesc} onClick={handleGenerateDesc} className="shrink-0 mb-0.5">
              AI ✨
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Category" placeholder="Apparel, Pins, Plush…" value={form.category} onChange={set('category')} />
          <div>
            <label className="text-sm font-medium text-gray-300">Condition</label>
            <select
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
              value={form.condition}
              onChange={set('condition')}
            >
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Starting price ($) *" type="number" step="0.01" min="0.01" placeholder="25.00" value={form.startingPrice} onChange={set('startingPrice')} required />
          <Input label="Buy now price ($)" type="number" step="0.01" min="0.01" placeholder="Optional" value={form.buyNowPrice} onChange={set('buyNowPrice')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" step="1" min="1" placeholder="1" value={form.quantity} onChange={set('quantity')} />
          <Input label="Size" placeholder="S, M, L, XL, One Size…" value={form.size} onChange={set('size')} />
        </div>

        {/* Photos — available once the item exists */}
        {current ? (
          <div>
            <label className="text-sm font-medium text-gray-300">Photos</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {current.images?.map(img => (
                <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-800 group">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >✕</button>
                </div>
              ))}
              <label className={`w-16 h-16 rounded-lg border-2 border-dashed border-gray-700 hover:border-brand-accent flex items-center justify-center cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                <span className="text-xl text-gray-500">{uploading ? '…' : '+'}</span>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Save the item, then you can attach photos.</p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} className="flex-1">
            {current ? 'Save Changes' : 'Add Item'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {current ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
