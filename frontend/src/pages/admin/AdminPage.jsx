import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminApi from '../../services/adminApi.js';
import useAuthStore from '../../store/authStore.js';

const ROLES = ['buyer', 'seller', 'admin', 'super_admin'];

const statCard = (label, value) => (
  <div key={label} className="bg-white rounded-xl shadow p-5 flex flex-col gap-1">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-3xl font-bold text-gray-900">{value}</span>
  </div>
);

function roleBadge(role) {
  const colours = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin:       'bg-blue-100 text-blue-800',
    seller:      'bg-green-100 text-green-800',
    buyer:       'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colours[role] || 'bg-gray-100 text-gray-700'}`}>
      {role}
    </span>
  );
}

export default function AdminPage() {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Platform settings (super_admin only)
  const [feeInput, setFeeInput]       = useState('');
  const [feeLoading, setFeeLoading]   = useState(false);
  const [feeSaved, setFeeSaved]       = useState(false);
  const [feeError, setFeeError]       = useState('');

  useEffect(() => {
    adminApi.getStats()
      .then(r => setStats(r.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    adminApi.getSettings()
      .then(r => {
        const rate = parseFloat(r.data.data.settings.platform_fee_rate ?? 0.01);
        setFeeInput((rate * 100).toFixed(2));
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    adminApi.listUsers({ page, limit: 20, search, role: roleFilter })
      .then(r => {
        setUsers(r.data.data.users);
        setTotal(r.data.data.total);
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  }, [page, search, roleFilter]);

  const toggleActive = async (user) => {
    try {
      await adminApi.updateUser(user.id, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch {
      setError('Failed to update user.');
    }
  };

  const changeRole = async (user, role) => {
    try {
      await adminApi.updateUser(user.id, { role });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u));
    } catch {
      setError('Failed to update role.');
    }
  };

  const savePlatformFee = async (e) => {
    e.preventDefault();
    setFeeError('');
    setFeeSaved(false);
    const pct = parseFloat(feeInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setFeeError('Enter a value between 0 and 100.');
      return;
    }
    setFeeLoading(true);
    try {
      await adminApi.updateSettings({ platform_fee_rate: pct / 100 });
      setFeeSaved(true);
      setTimeout(() => setFeeSaved(false), 3000);
    } catch {
      setFeeError('Failed to save settings.');
    } finally {
      setFeeLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCard('Users',          stats.totalUsers)}
          {statCard('Sellers',        stats.totalSellers)}
          {statCard('Events',         stats.totalEvents)}
          {statCard('Orders',         stats.totalOrders)}
          {statCard('Pending Orders', stats.pendingOrders)}
          {statCard('Revenue ($)',    (stats.totalRevenue / 100).toFixed(2))}
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Platform Settings</h2>
          <form onSubmit={savePlatformFee} className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600 font-medium">Platform Fee %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={feeInput}
                  onChange={e => setFeeInput(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm w-28"
                />
                <span className="text-sm text-gray-500">% of each transaction</span>
              </div>
              <p className="text-xs text-gray-400">
                Added to the per-seller commission on every checkout.
              </p>
            </div>
            <button
              type="submit"
              disabled={feeLoading}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium"
            >
              {feeLoading ? 'Saving…' : 'Save'}
            </button>
            {feeSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            {feeError && <span className="text-sm text-red-600">{feeError}</span>}
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Users</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              className="border rounded-lg px-3 py-1.5 text-sm w-48"
              placeholder="Search email / name…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <select
              className="border rounded-lg px-3 py-1.5 text-sm"
              value={roleFilter}
              onChange={e => { setRole(e.target.value); setPage(1); }}
            >
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Joined</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">No users found.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-800">{u.email}</td>
                  <td className="py-2 pr-4 text-gray-700">{u.first_name} {u.last_name}</td>
                  <td className="py-2 pr-4">
                    {u.role === 'super_admin' ? roleBadge(u.role) : (
                      <select
                        className="border rounded px-1 py-0.5 text-xs"
                        value={u.role}
                        onChange={e => changeRole(u, e.target.value)}
                      >
                        {ROLES.filter(r => r !== 'super_admin').map(r =>
                          <option key={r} value={r}>{r}</option>
                        )}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-2">
                    {u.role !== 'super_admin' && (
                      <button
                        onClick={() => toggleActive(u)}
                        className={`text-xs font-medium ${u.is_active ? 'text-red-600 hover:underline' : 'text-green-600 hover:underline'}`}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-4 justify-between text-sm text-gray-600">
          <span>{total} user{total !== 1 ? 's' : ''} total</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >Prev</button>
            <span className="px-2 py-1">Page {page}</span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
