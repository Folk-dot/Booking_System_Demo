import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyBookings } from '@/api/liffApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const STATUS_LABEL = {
  confirmed:   { label: 'ยืนยันแล้ว',     cls: 'bg-green-50 text-green-700 ring-green-200' },
  cancelled:   { label: 'ยกเลิกแล้ว',     cls: 'bg-red-50 text-red-700 ring-red-200' },
  rescheduled: { label: 'เปลี่ยนเวลาแล้ว', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch(() => setError('โหลดการจองไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-gray-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        กลับ
      </button>

      <h1 className="mb-6 text-xl font-bold text-gray-900">การจองของฉัน</h1>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner />
      ) : bookings.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-3 text-4xl">📋</div>
          <p className="text-gray-500">ยังไม่มีการจอง</p>
          <button onClick={() => navigate('/liff')} className="btn-primary mt-4">จองเทรนเนอร์</button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const trainer   = b.trainers;
            const eventType = b.event_types;
            const s = STATUS_LABEL[b.status] || STATUS_LABEL.confirmed;
            return (
              <div key={b.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {trainer?.avatar_url ? (
                      <img src={trainer.avatar_url} alt={trainer.name}
                        className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {trainer?.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{trainer?.name}</p>
                      <p className="text-xs text-gray-500">{formatDateRange(b.starts_at, b.ends_at)}</p>
                      {eventType && (
                        <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: eventType.color || '#3B82F6' }}>
                          {eventType.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
                {b.notes && (
                  <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{b.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
