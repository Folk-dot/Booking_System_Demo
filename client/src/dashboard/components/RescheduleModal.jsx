import { useEffect, useState } from 'react';
import dashApi from '@/api/dashApi.js';
import { formatDateRange, formatTime, toBkkDateStr } from '@/shared/utils/dateUtils.js';
import { format, addDays, startOfDay } from 'date-fns';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';

function getDates(count = 14) {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

export default function RescheduleModal({ booking, onClose, onSuccess }) {
  const dates = getDates();
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    const dateStr = toBkkDateStr(selectedDate);
    // Fetch trainer's own slots for that date
    dashApi
      .get('/slots/trainer', {
        params: {
          from: new Date(`${dateStr}T00:00:00+07:00`).toISOString(),
          to: new Date(`${dateStr}T23:59:59+07:00`).toISOString(),
        },
      })
      .then((r) => {
        // Only unbooked, unblocked slots
        setSlots(r.data.filter((s) => !s.booking && !s.isBlocked));
      })
      .catch(() => setError('Failed to load slots'))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, booking.trainee.id]);

  async function handleReschedule() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      await dashApi.patch(`/bookings/${booking.id}/reschedule`, { newSlotId: selectedSlot.id });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Reschedule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <p className="font-medium text-gray-900">{booking.trainee.name}</p>
          <p className="text-gray-500">{formatDateRange(booking.startsAt, booking.endsAt)}</p>
        </div>

        {/* Date strip */}
        <div className="-mx-2 overflow-x-auto">
          <div className="flex gap-2 px-2 pb-3" style={{ width: 'max-content' }}>
            {dates.map((date) => {
              const isSelected = toBkkDateStr(date) === toBkkDateStr(selectedDate);
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center rounded-xl px-3 py-2 text-center transition
                    ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <span className="text-xs">{format(date, 'EEE')}</span>
                  <span className="text-base font-bold">{format(date, 'd')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots */}
        <div className="my-3 max-h-48 overflow-y-auto">
          {loadingSlots ? (
            <LoadingSpinner text="Loading slots..." />
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No available slots on this date</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition
                    ${selectedSlot?.id === slot.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {formatTime(slot.startsAt)}
                </button>
              ))}
            </div>
          )}
        </div>

        <ErrorMessage message={error} />

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleReschedule}
            disabled={!selectedSlot || submitting}
            className="btn-primary flex-1"
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
