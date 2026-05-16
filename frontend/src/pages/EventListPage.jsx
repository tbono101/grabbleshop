import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import EventCard from '../components/events/EventCard.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import * as eventsApi from '../services/eventsApi.js';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'live', label: 'Live Now' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'ended', label: 'Past' },
];

export default function EventListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    eventsApi.listEvents({ status: status || undefined, limit: 24 })
      .then(r => setEvents(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Live Sales</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setSearchParams(s.value ? { status: s.value } : {})}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                status === s.value
                  ? 'bg-brand-accent text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {s.value === 'live' && <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-white align-middle" />}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-400">No events found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {events.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}
    </div>
  );
}
