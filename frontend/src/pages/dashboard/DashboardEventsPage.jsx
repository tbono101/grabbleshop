import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import * as eventsApi from '../../services/eventsApi.js';
import * as sellersApi from '../../services/sellersApi.js';
import { shortDate, relativeTime } from '../../utils/format.js';

export default function DashboardEventsPage() {
  const [events, setEvents] = useState([]);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  async function load() {
    try {
      const storeRes = await sellersApi.getMyStore();
      setStore(storeRes.data.data);
      const evRes = await eventsApi.listEvents({ sellerId: storeRes.data.data.id, limit: 50 });
      setEvents(evRes.data.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAction(action, eventId) {
    setActionLoading(eventId + action);
    try {
      if (action === 'start') await eventsApi.startEvent(eventId);
      if (action === 'end') await eventsApi.endEvent(eventId);
      if (action === 'cancel') await eventsApi.cancelEvent(eventId);
      if (action === 'delete') await eventsApi.deleteEvent(eventId);
      await load();
    } catch {}
    setActionLoading(null);
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Sale Events</h1>
        <Link to="/dashboard/events/new"><Button>+ New Event</Button></Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-gray-900 border border-gray-800">
          <p className="text-4xl mb-3">🎭</p>
          <p className="text-gray-400 mb-4">No events yet</p>
          <Link to="/dashboard/events/new"><Button>Create your first event</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <div key={event.id} className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge status={event.status} />
                    {event.listing_count > 0 && (
                      <span className="text-xs text-gray-500">{event.listing_count} items</span>
                    )}
                  </div>
                  <Link to={`/dashboard/events/${event.id}`} className="text-white font-semibold hover:text-brand-accent transition-colors">
                    {event.title}
                  </Link>
                  {event.scheduled_at && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {event.status === 'scheduled' ? `Starts ${relativeTime(event.scheduled_at)}` : shortDate(event.scheduled_at)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View public page */}
                  <Link to={`/events/${event.id}`} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                    View →
                  </Link>

                  {/* Edit */}
                  {['draft', 'scheduled'].includes(event.status) && (
                    <Link to={`/dashboard/events/${event.id}`}>
                      <Button size="xs" variant="secondary">Edit</Button>
                    </Link>
                  )}

                  {/* Start */}
                  {['draft', 'scheduled'].includes(event.status) && (
                    <Button
                      size="xs"
                      variant="primary"
                      loading={actionLoading === event.id + 'start'}
                      onClick={() => handleAction('start', event.id)}
                    >
                      Go Live
                    </Button>
                  )}

                  {/* End */}
                  {event.status === 'live' && (
                    <Button
                      size="xs"
                      variant="danger"
                      loading={actionLoading === event.id + 'end'}
                      onClick={() => handleAction('end', event.id)}
                    >
                      End Sale
                    </Button>
                  )}

                  {/* Delete draft */}
                  {event.status === 'draft' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      loading={actionLoading === event.id + 'delete'}
                      onClick={() => { if (confirm('Delete this event?')) handleAction('delete', event.id); }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
