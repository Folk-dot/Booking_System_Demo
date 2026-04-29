import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { getEventTypesForTrainer, getAvailableSlots } from '@/api/liffApi.js';
import { formatTime, formatDate } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

function getDates(count = 14) {
  const today = startOfDay(new Date());
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

export default function SlotPicker() {
  const { trainerId } = useParams();
  const { state }     = useLocation();
  const navigate      = useNavigate();
  const trainer       = state?.trainer;

  const [eventTypes, setEventTypes]       = useState([]);
  const [selectedType, setSelectedType]   = useState(null);
  const [selectedDate, setSelectedDate]   = useState(getDates()[0]);
  const [slots, setSlots]                 = useState([]);
  const [loadingTypes, setLoadingTypes]   = useState(true);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [error, setError]                 = useState('');

  const dates = getDates();

  // Load event types once
  useEffect(() => {
    getEventTypesForTrainer(trainerId)
      .then((data) => {
        setEventTypes(data);
        if (data.length === 1) setSelectedType(data[0]); // auto-select if only one
      })
      .catch(() => setError('โหลดประเภทการจองไม่สำเร็จ'))
      .finally(() => setLoadingTypes(false));
  }, [trainerId]);

  // Load slots when event type or date changes
  useEffect(() => {
    if (!selectedType) return;
    setLoadingSlots(true);
    setSlots([]);
    setError('');
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    getAvailableSlots(trainerId, selectedType.id, dateStr)
      .then(setSlots)
      .catch(() => setError('โหลดเวลาว่างไม่สำเร็จ'))
      .finally(() => setLoadingSlots(false));
  }, [trainerId, selectedType, selectedDate]);

  function handleSelectSlot(slot) {
    navigate('/confirm', { state: { slot, trainer, eventType: selectedType } });
  }

  if (loadingTypes) return <LoadingSpinner text="กำลังโหลด..." />;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b border-gray-100 p-4">
        <button onClick={() => navigate(-1)} className="mb-2 flex items-center gap-1 text-sm text-gray-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          กลับ
        </button>
        <h1 className="text-lg font-bold text-gray-900">{trainer?.name || 'เลือกเวลา'}</h1>
        {trainer?.specialty && <p className="text-sm text-brand-600">{trainer.specialty}</p>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Event type selector */}
        {eventTypes.length > 1 && (
          <div className="border-b border-gray-100 p-4">
            <p className="mb-2 text-sm font-medium text-gray-700">ประเภทการจอง</p>
            <div className="flex flex-wrap gap-2">
              {eventTypes.map((et) => (
                <button
                  key={et.id}
                  onClick={() => setSelectedType(et)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition
                    ${selectedType?.id === et.id
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  style={selectedType?.id === et.id ? { backgroundColor: et.color || '#3B82F6' } : {}}
                >
                  {et.name} ({et.duration_minutes} นาที)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date strip */}
        {selectedType && (
          <>
            <div className="overflow-x-auto border-b border-gray-100 bg-white">
              <div className="flex gap-2 px-4 py-3" style={{ width: 'max-content' }}>
                {dates.map((date) => {
                  const dateStr    = format(date, 'yyyy-MM-dd');
                  const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center rounded-xl px-3 py-2 text-center transition
                        ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
                    >
                      <span className="text-xs font-medium">{format(date, 'EEE')}</span>
                      <span className="text-lg font-bold leading-none">{format(date, 'd')}</span>
                      <span className="text-xs">{format(date, 'MMM')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slots */}
            <div className="p-4">
              <p className="mb-3 text-sm font-medium text-gray-500">{formatDate(selectedDate.toISOString())}</p>

              <ErrorMessage message={error} />

              {loadingSlots ? (
                <LoadingSpinner text="กำลังโหลดเวลาว่าง..." />
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="mb-3 text-4xl">📅</div>
                  <p className="font-medium text-gray-600">ไม่มีเวลาว่างในวันนี้</p>
                  <p className="mt-1 text-sm text-gray-400">ลองเลือกวันอื่น</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.slot_start}
                      onClick={() => handleSelectSlot(slot)}
                      className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-gray-100
                                 transition hover:ring-brand-400 active:scale-95"
                    >
                      <p className="text-lg font-bold text-gray-900">{formatTime(slot.slot_start)}</p>
                      <p className="text-xs text-gray-400">ถึง {formatTime(slot.slot_end)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Prompt when no event type selected yet */}
        {!selectedType && !loadingTypes && eventTypes.length > 1 && (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-500">เลือกประเภทการจองด้านบนก่อน</p>
          </div>
        )}
      </div>
    </div>
  );
}
