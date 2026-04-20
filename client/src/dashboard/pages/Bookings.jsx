import { useEffect, useState, useCallback } from 'react';
import dashApi from '@/api/dashApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import RescheduleModal from '../components/RescheduleModal.jsx';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    dashApi
      .get('/bookings/trainer')
      .then((r) => setBookings(r.data))
      .catch(() => setError('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(bookingId) {
    if (!confirm('Cancel this booking? The trainee will be notified via LINE.')) return;
    setCancellingId(bookingId);
    try {
      await dashApi.patch(`/bookings/${bookingId}/cancel`);
      setBookings((b) => b.filter((bk) => bk.id !== bookingId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">{bookings.length} confirmed session{bookings.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="btn-secondary text-xs px-3 py-2">
          Refresh
        </button>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner text="Loading bookings..." />
      ) : bookings.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="mb-3 text-4xl">🗓️</div>
          <p className="font-medium text-gray-600">No upcoming bookings</p>
          <p className="mt-1 text-sm text-gray-400">Set your availability to start receiving bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {b.trainee.pictureUrl ? (
                  <img src={b.trainee.pictureUrl} alt={b.trainee.name}
                    className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-500">
                    {(b.trainee.name || '?').charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{b.trainee.name || 'LINE User'}</p>
                  <p className="text-sm text-gray-500">{formatDateRange(b.startsAt, b.endsAt)}</p>
                  {b.notes && (
                    <p className="mt-1 text-xs text-gray-400 italic">"{b.notes}"</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setRescheduleBooking(b)}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  Reschedule
                </button>
                <button
                  onClick={() => handleCancel(b.id)}
                  disabled={cancellingId === b.id}
                  className="btn-danger text-xs px-3 py-2"
                >
                  {cancellingId === b.id ? '...' : 'Cancel'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rescheduleBooking && (
        <RescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onSuccess={() => { setRescheduleBooking(null); load(); }}
        />
      )}
    </div>
  );
}
