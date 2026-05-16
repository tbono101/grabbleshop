import { Link } from 'react-router-dom';
import Badge from '../ui/Badge.jsx';
import { relativeTime, shortDate } from '../../utils/format.js';

export default function EventCard({ event }) {
  const isLive = event.status === 'live';
  return (
    <Link
      to={`/events/${event.id}`}
      className={`
        group block rounded-2xl overflow-hidden border transition-all duration-200
        ${isLive
          ? 'border-brand-accent/50 shadow-lg shadow-brand-accent/10 hover:shadow-brand-accent/20'
          : 'border-gray-800 hover:border-gray-700'}
        bg-gray-900 hover:-translate-y-0.5
      `}
    >
      {/* Cover image / placeholder */}
      <div className="relative aspect-video bg-gray-800 overflow-hidden">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-20">🏰</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge status={event.status} />
        </div>
        {isLive && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-1 font-medium">{event.shop_name}</p>
        <h3 className="text-white font-semibold leading-snug line-clamp-2 group-hover:text-brand-accent transition-colors">
          {event.title}
        </h3>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            {event.listing_count ?? 0} item{event.listing_count !== 1 ? 's' : ''}
          </span>
          {event.scheduled_at && (
            <span>{isLive ? 'Started' : 'Starts'} {relativeTime(event.started_at || event.scheduled_at)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
