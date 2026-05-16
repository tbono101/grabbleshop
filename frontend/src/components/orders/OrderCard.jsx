import { Link } from 'react-router-dom';
import Badge from '../ui/Badge.jsx';
import { cents, shortDate, shortId } from '../../utils/format.js';

export default function OrderCard({ order }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500">#{shortId(order.id)}</span>
            <Badge status={order.status} />
          </div>
          <p className="text-sm font-medium text-white">
            {order.shop_name ?? order.seller_shop_name}
          </p>
          {(order.item_count || order.items?.length) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {order.item_count ?? order.items?.length} item{(order.item_count ?? order.items?.length) !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-white">{cents(order.total)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{shortDate(order.created_at)}</p>
        </div>
      </div>
    </Link>
  );
}
