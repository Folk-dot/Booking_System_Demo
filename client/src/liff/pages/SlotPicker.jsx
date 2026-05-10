import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  format, startOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isBefore, addMonths, subMonths,
} from 'date-fns';
import { getEventTypesForTrainer, getAvailableSlots } from '@/api/liffApi.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function CalendarGrid({ selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));
  const today = startOfDay(new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end:   endOfWeek(endOfMonth(viewMonth)),
  });

  return (
    <div className="border-b border-gray-100">
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm font-semibold text-gray-900">
          {format(viewMonth, 'MMMM')}{' '}
          <span className="font-normal text-gray-400">{format(viewMonth, 'yyyy')}</span>
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 px-3">
        {DAY_HEADERS.map(d => (
          <div key={d} className="py-1.5 text-center text-[10px] font-medium tracking-wide text-gray-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pb-4">
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
                isSelected
                  ? 'bg-gray-900 font-semibold text-white'
                  : '',
                !isSelected && isToday
                  ? 'bg-gray-100 font-semibold text-gray-900 ring-2 ring-inset ring-gray-900'
                  : '',
                !isSelected && !isToday && !disabled
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white'
                  : '',
                disabled
                  ? 'cursor-not-allowed text-gray-200'
                  : '',
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

export default function SlotPicker() {
  const { trainerId } = useParams();
  const { state }     = useLocation();
  const navigate      = useNavigate();
  const trainer       = state?.trainer;

  const [eventTypes, setEventTypes]     = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [slots, setSlots]               = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError]               = useState('');
  const [use24h, setUse24h]             = useState(false);

  useEffect(() => {
    getEventTypesForTrainer(trainerId)
      .then(data => {
        setEventTypes(data);
        if (data.length === 1) setSelectedType(data[0]);
      })
      .catch(() => setError('Failed to Load'))
      .finally(() => setLoadingTypes(false));
  }, [trainerId]);

  useEffect(() => {
    if (!selectedType) return;
    setLoadingSlots(true);
    setSlots([]);
    setError('');
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    getAvailableSlots(trainerId, selectedType.id, dateStr)
      .then(setSlots)
      .catch(() => setError('Failed to Load'))
      .finally(() => setLoadingSlots(false));
  }, [trainerId, selectedType, selectedDate]);

  function handleSelectSlot(slot) {
    navigate('/confirm', { state: { slot, trainer, eventType: selectedType } });
  }

  function displayTime(iso) {
    return format(new Date(iso), use24h ? 'HH:mm' : 'h:mmaaa');
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (loadingTypes) return <LoadingSpinner text="Loading..." />;

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 pb-4 pt-5">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-3">
          {trainer?.avatar_url ? (
            <img src={trainer.avatar_url} alt={trainer.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
              {trainer?.name?.charAt(0) ?? '?'}
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400">{trainer?.name}</p>
            <h1 className="text-lg font-bold leading-tight text-gray-900">
              {selectedType?.name ?? 'Select a service'}
            </h1>
          </div>
        </div>

        {selectedType && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              {selectedType.duration_minutes} min
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              {timezone}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Event type selector */}
        {eventTypes.length > 1 && (
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Session Type
            </p>
            <div className="space-y-2">
              {eventTypes.map(et => {
                const isSelected = selectedType?.id === et.id;
                return (
                  <button
                    key={et.id}
                    onClick={() => setSelectedType(et)}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                      isSelected
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400'}`} />
                    <span className="flex-1 text-sm font-medium">{et.name}</span>
                    <span className={`text-xs ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>
                      {et.duration_minutes} min
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar */}
        {selectedType && (
          <>
            <CalendarGrid selectedDate={selectedDate} onSelectDate={setSelectedDate} />

            {/* Time slots */}
            <div className="px-5 py-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  {format(selectedDate, 'EEE d')}
                </p>
                <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
                  <button
                    onClick={() => setUse24h(false)}
                    className={`px-3 py-1.5 transition ${!use24h ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    12h
                  </button>
                  <button
                    onClick={() => setUse24h(true)}
                    className={`px-3 py-1.5 transition ${use24h ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    24h
                  </button>
                </div>
              </div>

              <ErrorMessage message={error} />

              {loadingSlots ? (
                <LoadingSpinner text="Loading..." />
              ) : slots.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-gray-400">No availability</p>
                  <p className="mt-1 text-xs text-gray-300">Try selecting another date</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slots.map(slot => (
                    <button
                      key={slot.slot_start}
                      onClick={() => handleSelectSlot(slot)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 text-left transition hover:border-gray-400 hover:bg-gray-50 active:scale-[0.99]"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                      <span className="text-sm font-medium text-gray-900">{displayTime(slot.slot_start)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {!selectedType && !loadingTypes && eventTypes.length > 1 && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">Select a service above to continue</p>
          </div>
        )}
      </div>
    </div>
  );
}
