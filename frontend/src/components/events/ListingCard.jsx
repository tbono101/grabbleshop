import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import { cents } from '../../utils/format.js';

export default function ListingCard({ listing, onActivate, onClaim, isSellerView, claiming }) {
  const images = listing.image_urls ?? [];

  return (
    <div className={`
      rounded-xl border bg-gray-900 overflow-hidden transition-all
      ${listing.status === 'active' ? 'border-brand-accent shadow-lg shadow-brand-accent/20' : 'border-gray-800'}
    `}>
      {/* Image */}
      <div className="relative aspect-square bg-gray-800">
        {images[0] ? (
          <img src={images[0]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🏷️</div>
        )}
        <div className="absolute top-2 left-2">
          <Badge status={listing.status} />
        </div>
      </div>

      <div className="p-3">
        <h4 className="text-sm font-semibold text-white line-clamp-2 mb-1">{listing.title}</h4>
        <p className="text-brand-gold font-bold">{cents(listing.starting_price)}</p>
        {listing.buy_now_price && (
          <p className="text-xs text-gray-500 mt-0.5">Buy now: {cents(listing.buy_now_price)}</p>
        )}

        {/* Seller action */}
        {isSellerView && listing.status === 'pending' && onActivate && (
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => onActivate(listing.id)}>
            Set Live
          </Button>
        )}

        {/* Buyer action */}
        {!isSellerView && listing.status === 'active' && onClaim && (
          <Button size="sm" variant="gold" className="mt-3 w-full" loading={claiming} onClick={() => onClaim(listing)}>
            GRAB IT!
          </Button>
        )}
      </div>
    </div>
  );
}
