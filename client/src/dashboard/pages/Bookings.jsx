import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase.js';
import { getMyBookings, cancelBooking } from '@/api/dashApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';

export default function Bookings() {
  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [reschedule, setReschedule]   = useState(null);

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
        <button onClick={load} className="btn-secondary px-3 py-2 text-xs">Refresh</button>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner text="Loading bookings..." />
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <p className="font-medium text-gray-500">No upcoming bookings</p>
          <p className="mt-1 text-sm text-gray-400">Set your availability to start receiving bookings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const trainee   = b.trainees;
            const eventType = b.event_types;
            return (
              <div key={b.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {trainee?.picture_url ? (
                    <img src={trainee.picture_url} alt={trainee.display_name}
                      className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                      {(trainee?.display_name || '?').charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{trainee?.display_name || 'LINE User'}</p>
                    <p className="text-sm text-gray-500">{formatDateRange(b.starts_at, b.ends_at)}</p>
                    {eventType && (
                      <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {eventType.name}
                      </span>
                    )}
                    {b.notes && <p className="mt-1 text-xs italic text-gray-400">"{b.notes}"</p>}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setReschedule(b)} className="btn-secondary px-3 py-2 text-xs">
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleCancel(b.id, trainee?.line_uid, b.tenant_id, b.trainers?.name, b.starts_at)}
                    disabled={cancellingId === b.id}
                    className="btn-danger px-3 py-2 text-xs"
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
