import { useEffect, useState } from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { getAvailableSlots, rescheduleBooking } from '@/api/dashApi.js';
import { formatDateRange, formatTime } from '@/shared/utils/dateUtils.js';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';

function getDates(count = 14) {
  return Array.from({ length: count }, (_, i) => addDays(startOfDay(new Date()), i));
}

export default function RescheduleModal({ booking, onClose, onSuccess }) {
  const dates = getDates();
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [slots, setSlots]               = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setSlots([]);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    getAvailableSlots(booking.trainer_id, booking.event_type_id, dateStr)
      .then(setSlots)
      .catch(() => setError('Failed to load available slots'))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, booking.trainer_id, booking.event_type_id]);

  async function handleReschedule() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      await rescheduleBooking(booking.id, selectedSlot.slot_start, selectedSlot.slot_end);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  }

  const trainee = booking.trainees;

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
          <p className="font-medium text-gray-900">{trainee?.display_name || 'LINE User'}</p>
          <p className="text-gray-500">{formatDateRange(booking.starts_at, booking.ends_at)}</p>
          {booking.event_types && (
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: booking.event_types.color || '#3B82F6' }}>
              {booking.event_types.name}
            </span>
          )}
        </div>

        {/* Date strip */}
        <div className="-mx-2 overflow-x-auto">
          <div className="flex gap-2 px-2 pb-3" style={{ width: 'max-content' }}>
            {dates.map((date) => {
              const dateStr    = format(date, 'yyyy-MM-dd');
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;
              return (
                <button
                  key={dateStr}
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
                  key={slot.slot_start}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition
                    ${selectedSlot?.slot_start === slot.slot_start
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {formatTime(slot.slot_start)}
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
