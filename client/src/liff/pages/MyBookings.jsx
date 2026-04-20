import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import liffApi from '@/api/liffApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const STATUS_LABEL = {
  confirmed: { label: 'ยืนยันแล้ว', cls: 'badge-confirmed' },
  cancelled: { label: 'ยกเลิกแล้ว', cls: 'badge-cancelled' },
  rescheduled: { label: 'เปลี่ยนเวลาแล้ว', cls: 'badge-rescheduled' },
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    liffApi
      .get('/bookings/me')
      .then((r) => setBookings(r.data))
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
          <button onClick={() => navigate('/')} className="btn-primary mt-4">
            จองเทรนเนอร์
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const s = STATUS_LABEL[b.status] || STATUS_LABEL.confirmed;
            return (
              <div key={b.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {b.trainer.avatarUrl ? (
                      <img src={b.trainer.avatarUrl} alt={b.trainer.name}
                        className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 text-sm">
                        {b.trainer.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{b.trainer.name}</p>
                      <p className="text-xs text-gray-500">{formatDateRange(b.startsAt, b.endsAt)}</p>
                    </div>
                  </div>
                  <span className={s.cls}>{s.label}</span>
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
