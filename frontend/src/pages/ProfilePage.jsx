import { useState, useEffect } from 'react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import useAuthStore from '../store/authStore.js';
import api from '../services/api.js';
import * as authApi from '../services/authApi.js';

export default function ProfilePage() {
  const { user, setAuth, token } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addrModal, setAddrModal] = useState(false);
  const [addrForm, setAddrForm] = useState({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'US', isDefault: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [meRes, addrRes] = await Promise.all([
          authApi.getMe(),
          api.get('/users/me/addresses'),
        ]);
        setProfile(meRes.data.data.user);
        setAddresses(addrRes.data.data || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.patch('/users/me', {
        firstName: profile.first_name,
        lastName: profile.last_name,
        phone: profile.phone,
      });
      setProfile(res.data.data);
      setAuth(res.data.data, token);
      setSuccess('Profile updated!');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function addAddress(e) {
    e.preventDefault();
    try {
      const res = await api.post('/users/me/addresses', addrForm);
      setAddresses(a => [...a, res.data.data]);
      setAddrModal(false);
      setAddrForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'US', isDefault: false });
    } catch {}
  }

  async function deleteAddress(id) {
    try {
      await api.delete(`/users/me/addresses/${id}`);
      setAddresses(a => a.filter(x => x.id !== id));
    } catch {}
  }

  async function setDefault(id) {
    try {
      await api.post(`/users/me/addresses/${id}/default`);
      setAddresses(a => a.map(x => ({ ...x, is_default: x.id === id ? 1 : 0 })));
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      {/* Profile form */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Personal info</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={profile?.first_name || ''} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} />
            <Input label="Last name" value={profile?.last_name || ''} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} />
          </div>
          <Input label="Email" value={profile?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
          <Input label="Phone" value={profile?.phone || ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">{success}</p>}
          <Button type="submit" loading={saving}>Save changes</Button>
        </form>
      </section>

      {/* Addresses */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Shipping addresses</h2>
          <Button size="sm" variant="secondary" onClick={() => setAddrModal(true)}>+ Add</Button>
        </div>
        {addresses.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No addresses saved</p>
        ) : (
          <div className="space-y-3">
            {addresses.map(a => (
              <div key={a.id} className="flex items-start justify-between rounded-xl bg-gray-800 border border-gray-700 p-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {a.label && <span className="text-xs text-gray-400 font-medium">{a.label}</span>}
                    {a.is_default === 1 && <span className="text-xs bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded font-medium">Default</span>}
                  </div>
                  <address className="not-italic text-sm text-gray-300 leading-relaxed">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />
                    {a.city}, {a.state} {a.zip}
                  </address>
                  {a.is_default !== 1 && (
                    <button onClick={() => setDefault(a.id)} className="text-xs text-gray-500 hover:text-gray-300 mt-1 transition-colors">
                      Set as default
                    </button>
                  )}
                </div>
                <button onClick={() => deleteAddress(a.id)} className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-4 shrink-0">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add address modal */}
      <Modal isOpen={addrModal} onClose={() => setAddrModal(false)} title="Add address">
        <form onSubmit={addAddress} className="space-y-3">
          <Input label="Label (optional)" placeholder='"Home", "Work"…' value={addrForm.label} onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))} />
          <Input label="Street address *" placeholder="123 Main St" value={addrForm.line1} onChange={e => setAddrForm(f => ({ ...f, line1: e.target.value }))} required />
          <Input label="Apt / Suite" placeholder="Apt 4B" value={addrForm.line2} onChange={e => setAddrForm(f => ({ ...f, line2: e.target.value }))} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="City *" placeholder="Orlando" value={addrForm.city} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} required />
            <Input label="State *" placeholder="FL" value={addrForm.state} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} required />
            <Input label="ZIP *" placeholder="32830" value={addrForm.zip} onChange={e => setAddrForm(f => ({ ...f, zip: e.target.value }))} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" className="rounded" checked={addrForm.isDefault} onChange={e => setAddrForm(f => ({ ...f, isDefault: e.target.checked }))} />
            Set as default
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Save address</Button>
            <Button type="button" variant="outline" onClick={() => setAddrModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
