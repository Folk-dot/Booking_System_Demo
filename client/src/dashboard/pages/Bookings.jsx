import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase.js';
import { getMyBookings, cancelBooking, rescheduleBooking } from '@/api/dashApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [reschedule, setReschedule] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyBookings({ from: new Date().toISOString() });
      setBookings(data);
    } catch {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(bookingId, traineeLineUid, traineetenantId, trainerName, startsAt) {
    if (!confirm('Cancel this booking? The trainee will be notified via LINE.')) return;
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId);
      setBookings((b) => b.filter((bk) => bk.id !== bookingId));
      // Fire-and-forget LINE notification
      if (traineeLineUid) {
        const { data: { session } } = await supabase.auth.getSession();
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            type: 'booking_cancelled', tenantId: traineetenantId,
            lineUid: traineeLineUid, trainerName, startsAt, cancelledBy: 'trainer',
          }),
        }).catch(() => {});
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">
            {bookings.length} confirmed session{bookings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-xs px-3 py-2">Refresh</button>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner text="Loading bookings..." />
      ) : bookings.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="font-medium text-gray-600">No upcoming bookings</p>
          <p className="mt-1 text-sm text-gray-400">Set your availability to start receiving bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const trainee = b.trainees;
            const eventType = b.event_types;
            return (
              <div key={b.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {trainee?.picture_url ? (
                    <img src={trainee.picture_url} alt={trainee.display_name}
                      className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500">
                      {(trainee?.display_name || '?').charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{trainee?.display_name || 'LINE User'}</p>
                    <p className="text-sm text-gray-500">{formatDateRange(b.starts_at, b.ends_at)}</p>
                    {eventType && (
                      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: eventType.color || '#3B82F6' }}>
                        {eventType.name}
                      </span>
                    )}
                    {b.notes && <p className="mt-1 text-xs text-gray-400 italic">"{b.notes}"</p>}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setReschedule(b)} className="btn-secondary text-xs px-3 py-2">
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleCancel(b.id, trainee?.line_uid, b.tenant_id, b.trainers?.name, b.starts_at)}
                    disabled={cancellingId === b.id}
                    className="btn-danger text-xs px-3 py-2"
                  >
                    {cancellingId === b.id ? '...' : 'Cancel'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reschedule && (
        <RescheduleModal
          booking={reschedule}
          onClose={() => setReschedule(null)}
          onSuccess={() => { setReschedule(null); load(); }}
        />
      )}
    </div>
  );
}
