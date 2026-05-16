import { Link } from 'react-router-dom';

export default function SellerCard({ seller }) {
  const initials = `${seller.first_name?.[0] || ''}${seller.last_name?.[0] || ''}`.toUpperCase();

  return (
    <Link
      to={`/sellers/${seller.id}`}
      className="group block rounded-2xl border border-gray-800 bg-gray-900 hover:border-gray-700 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      {/* Banner */}
      <div className="h-20 bg-gradient-to-r from-brand to-brand-light relative">
        {seller.banner_url && (
          <img src={seller.banner_url} alt="" className="w-full h-full object-cover opacity-50" />
        )}
      </div>

      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="relative -mt-8 mb-3">
          {seller.avatar_url ? (
            <img
              src={seller.avatar_url}
              alt={seller.shop_name}
              className="w-16 h-16 rounded-full border-4 border-gray-900 object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-4 border-gray-900 bg-brand-accent flex items-center justify-center text-xl font-bold text-white">
              {initials || '?'}
            </div>
          )}
        </div>

        <h3 className="text-white font-bold leading-tight group-hover:text-brand-accent transition-colors">
          {seller.shop_name}
        </h3>
        {seller.bio && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{seller.bio}</p>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
          <span>{seller.total_sales} sales</span>
          {seller.count > 0 && (
            <span>★ {Number(seller.avg_rating).toFixed(1)} ({seller.count})</span>
          )}
        </div>
      </div>
    </Link>
  );
}
