import { useState, useEffect, useRef } from 'react';
import SellerCard from '../components/sellers/SellerCard.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import * as sellersApi from '../services/sellersApi.js';

export default function SellerListPage() {
  const [sellers, setSellers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const debounce = useRef(null);

  function search(query) {
    setLoading(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      sellersApi.listSellers({ q: query || undefined, limit: 30 })
        .then(r => setSellers(r.data.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
  }

  useEffect(() => { search(''); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Sellers</h1>
        <input
          type="search"
          placeholder="Search sellers…"
          value={q}
          onChange={e => { setQ(e.target.value); search(e.target.value); }}
          className="w-full max-w-sm rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 focus:border-brand-accent"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-400">No sellers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sellers.map(s => <SellerCard key={s.id} seller={s} />)}
        </div>
      )}
    </div>
  );
}
