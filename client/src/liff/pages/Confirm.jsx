import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createBooking } from '@/api/liffApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

export default function Confirm() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const { slot, trainer, eventType } = state || {};

  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  if (!slot || !trainer || !eventType) {
    navigate('/');
    return null;
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await createBooking({
        trainerId:   trainer.id,
        eventTypeId: eventType.id,
        startsAt:    slot.slot_start,
        endsAt:      slot.slot_end,
        notes:       notes || undefined,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        setError('เวลานี้ถูกจองแล้ว กรุณาเลือกเวลาใหม่');
      } else {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-1 text-xl font-bold text-gray-900">Booking confirmed</h2>
        <p className="text-sm text-gray-500">{trainer.name} · {eventType.name}</p>
        <p className="mt-1 text-sm text-gray-400">{formatDateRange(slot.slot_start, slot.slot_end)}</p>
        <p className="mt-4 text-xs text-gray-300">You'll receive a confirmation via LINE</p>
        <div className="mt-8 w-full space-y-2">
          <button onClick={() => navigate('/liff')} className="btn-primary w-full">Back to home</button>
          <button onClick={() => navigate('/my-bookings')} className="btn-secondary w-full">View my bookings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="border-b border-gray-100 px-5 pb-4 pt-5">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Confirm booking</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Booking summary */}
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            {trainer.avatar_url ? (
              <img src={trainer.avatar_url} alt={trainer.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 font-semibold text-white">
                {trainer.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{trainer.name}</p>
              {trainer.specialty && <p className="text-xs text-gray-400">{trainer.specialty}</p>}
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Session</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">
                {eventType.name} · {eventType.duration_minutes} min
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Date & Time</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">
                {formatDateRange(slot.slot_start, slot.slot_end)}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-5">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Goals, injuries, requests..."
            rows={3}
            className="input resize-none"
          />
        </div>

        <div className="mt-4">
          <ErrorMessage message={error} />
        </div>
      </div>

      <div className="border-t border-gray-100 px-5 py-4 space-y-2">
        <button onClick={handleConfirm} disabled={loading} className="btn-primary w-full">
          {loading ? 'Confirming...' : 'Confirm booking'}
        </button>
        <button onClick={() => navigate(-1)} className="btn-secondary w-full">Cancel</button>
      </div>
    </div>
  );
}
