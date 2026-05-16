import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import api from '../services/api.js';
import * as sellersApi from '../services/sellersApi.js';
import * as authApi from '../services/authApi.js';
import useAuthStore from '../store/authStore.js';

export default function BecomeSeller() {
  const navigate = useNavigate();
  const { setAuth, token } = useAuthStore();
  const [form, setForm] = useState({ shopName: '', bio: '', instagramHandle: '', tiktokHandle: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sellersApi.createSeller(form);
      const meRes = await authApi.getMe();
      setAuth(meRes.data.data.user, token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create seller account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-8">
        <p className="text-4xl mb-3">🏰</p>
        <h1 className="text-2xl font-bold text-white">Start selling on GrabbleShop</h1>
        <p className="text-sm text-gray-400 mt-2">
          Set up your storefront and run live Disney personal shopping sales.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Shop name *" placeholder='"Magic Hauls by Tina"' value={form.shopName} onChange={set('shopName')} required />
          <div>
            <label className="text-sm font-medium text-gray-300">Bio</label>
            <textarea
              className="mt-1 w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 resize-none"
              rows={3}
              placeholder="Tell buyers about yourself and which parks you visit…"
              value={form.bio}
              onChange={set('bio')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Instagram" placeholder="@yourhandle" value={form.instagramHandle} onChange={set('instagramHandle')} />
            <Input label="TikTok" placeholder="@yourhandle" value={form.tiktokHandle} onChange={set('tiktokHandle')} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Create my shop</Button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        {['Run live sales', 'Get paid instantly', 'We handle tax & shipping'].map(t => (
          <div key={t} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
            <p className="text-xs text-gray-400">{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
