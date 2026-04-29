import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createBooking } from '@/api/liffApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

export default function Confirm() {
  const { state } = useLocation();
  const navigate  = useNavigate();
  const { slot, trainer, eventType } = state || {};

  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState(null);

  if (!slot || !trainer || !eventType) {
    navigate('/');
    return null;
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const booking = await createBooking({
        trainerId:   trainer.id,
        eventTypeId: eventType.id,
        startsAt:    slot.slot_start,
        endsAt:      slot.slot_end,
        notes:       notes || undefined,
      });
      setBookingId(booking.id);
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
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 text-6xl">✅</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">จองสำเร็จแล้ว!</h2>
        <p className="mb-1 font-medium text-gray-700">{trainer.name}</p>
        <p className="mb-1 text-sm text-brand-600">{eventType.name}</p>
        <p className="mb-6 text-sm text-gray-500">{formatDateRange(slot.slot_start, slot.slot_end)}</p>
        <p className="mb-8 text-sm text-gray-400">คุณจะได้รับข้อความยืนยันทาง LINE</p>
        <button onClick={() => navigate('/liff')} className="btn-primary w-full">กลับหน้าหลัก</button>
        <button onClick={() => navigate('/my-bookings')} className="btn-secondary mt-3 w-full">
          ดูการจองของฉัน
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-4">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        กลับ
      </button>

      <h1 className="mb-6 text-xl font-bold text-gray-900">ยืนยันการจอง</h1>

      <div className="card mb-6 space-y-4">
        <div className="flex items-center gap-3">
          {trainer.avatar_url ? (
            <img src={trainer.avatar_url} alt={trainer.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
              {trainer.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{trainer.name}</p>
            {trainer.specialty && <p className="text-xs text-brand-600">{trainer.specialty}</p>}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">ประเภทการจอง</p>
            <p className="mt-0.5 font-medium text-gray-900">
              <span className="mr-2 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: eventType.color || '#3B82F6' }} />
              {eventType.name} ({eventType.duration_minutes} นาที)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">วัน/เวลา</p>
            <p className="mt-0.5 font-medium text-gray-900">{formatDateRange(slot.slot_start, slot.slot_end)}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">หมายเหตุ (ไม่บังคับ)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="เช่น เป้าหมาย, อาการบาดเจ็บ..."
          rows={3}
          className="input resize-none"
        />
      </div>

      <ErrorMessage message={error} />

      <div className="mt-auto space-y-3">
        <button onClick={handleConfirm} disabled={loading} className="btn-primary w-full">
          {loading ? 'กำลังจอง...' : 'ยืนยันการจอง'}
        </button>
        <button onClick={() => navigate(-1)} className="btn-secondary w-full">ยกเลิก</button>
      </div>
    </div>
  );
}
