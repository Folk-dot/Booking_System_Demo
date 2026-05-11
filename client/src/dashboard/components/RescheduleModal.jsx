import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.js';
import {
  format, startOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isBefore, addMonths, subMonths,
} from 'date-fns';
import { getAvailableSlots, rescheduleBooking } from '@/api/dashApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';

const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function CalendarGrid({ selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));
  const today = startOfDay(new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end:   endOfWeek(endOfMonth(viewMonth)),
  });

  return (
    <div className="border-b border-gray-100 pb-3">
      <div className="flex items-center justify-between px-1 py-2">
        <span className="text-sm font-semibold text-gray-900">
          {format(viewMonth, 'MMMM')}{' '}
          <span className="font-normal text-gray-400">{format(viewMonth, 'yyyy')}</span>
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {DAY_HEADERS.map(d => (
          <div key={d} className="py-1 text-center text-[10px] font-medium tracking-wide text-gray-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isPast     = isBefore(day, today);
          const isOutside  = !isSameMonth(day, viewMonth);
          const isSelected = isSameDay(day, selectedDate);
          const isToday    = isSameDay(day, today);
          const disabled   = isPast || isOutside;

          if (isOutside) return <div key={day.toISOString()} />;

          return (
            <button
              key={day.toISOString()}
              disabled={disabled}
              onClick={() => !disabled && onSelectDate(day)}
              className={[
                'mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition',
                isSelected ? 'bg-gray-900 font-semibold text-white' : '',
                !isSelected && isToday ? 'bg-gray-100 font-semibold text-gray-900 ring-2 ring-inset ring-gray-900' : '',
                !isSelected && !isToday && !disabled ? 'bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white' : '',
                disabled ? 'cursor-not-allowed text-gray-200' : '',
              ].filter(Boolean).join(' ')}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RescheduleModal({ booking, onClose, onSuccess }) {
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [slots, setSlots]               = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');
  const [use24h, setUse24h]             = useState(false);

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    setSlots([]);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    getAvailableSlots(booking.specialist_id, booking.event_type_id, dateStr)
      .then(setSlots)
      .catch(() => setError('Failed to load available slots'))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, booking.specialist_id, booking.event_type_id]);

  async function handleReschedule() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      await rescheduleBooking(booking.id, selectedSlot.slot_start, selectedSlot.slot_end);
      const client = booking.clients;
      if (client?.line_uid) {
        const { data: { session } } = await supabase.auth.getSession();
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            type:           'booking_rescheduled',
            tenantId:       booking.tenant_id,
            lineUid:        client.line_uid,
            specialistName: booking.specialists?.name,
            startsAt:       selectedSlot.slot_start,
            endsAt:         selectedSlot.slot_end,
          }),
        }).catch(() => {});
      }
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  }

  function displayTime(iso) {
    return format(new Date(iso), use24h ? 'HH:mm' : 'h:mmaaa');
  }

  const trainee = booking.clients;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Reschedule</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {trainee?.display_name || 'LINE User'}
              {booking.event_types ? ` · ${booking.event_types.name}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <CalendarGrid selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          {/* Slot header */}
          <div className="mb-3 mt-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {format(selectedDate, 'EEE d')}
            </p>
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
              <button
                onClick={() => setUse24h(false)}
                className={`px-3 py-1.5 transition ${!use24h ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >12h</button>
              <button
                onClick={() => setUse24h(true)}
                className={`px-3 py-1.5 transition ${use24h ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >24h</button>
            </div>
          </div>

          <ErrorMessage message={error} />

          {loadingSlots ? (
            <LoadingSpinner text="Loading slots..." />
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No available slots on this date</p>
          ) : (
            <div className="space-y-2">
              {slots.map(slot => (
                <button
                  key={slot.slot_start}
                  onClick={() => setSelectedSlot(slot)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    selectedSlot?.slot_start === slot.slot_start
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${selectedSlot?.slot_start === slot.slot_start ? 'bg-white' : 'bg-emerald-400'}`} />
                  <span className="text-sm font-medium">{displayTime(slot.slot_start)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
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
