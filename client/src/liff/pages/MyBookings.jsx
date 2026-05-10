import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyBookings } from '@/api/liffApi.js';
import { formatDateRange } from '@/shared/utils/dateUtils.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const STATUS = {
  confirmed:   { label: 'Confirmed',   cls: 'bg-gray-100 text-gray-700' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600' },
  rescheduled: { label: 'Rescheduled', cls: 'bg-amber-50 text-amber-700' },
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
    <div className="flex h-screen flex-col bg-white">
      <div className="border-b border-gray-100 px-5 pb-4 pt-5">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-600">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">My bookings</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <ErrorMessage message={error} />

        {loading ? (
          <LoadingSpinner />
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-400">No bookings yet</p>
            <button onClick={() => navigate('/')} className="btn-primary mt-5">Book a session</button>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map(b => {
              const trainer   = b.trainers;
              const eventType = b.event_types;
              const s = STATUS[b.status] ?? STATUS.confirmed;
              return (
                <div key={b.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {trainer?.avatar_url ? (
                        <img src={trainer.avatar_url} alt={trainer.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                          {trainer?.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{trainer?.name}</p>
                        {eventType && (
                          <p className="mt-0.5 text-xs text-gray-500">{eventType.name} · {eventType.duration_minutes} min</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400">{formatDateRange(b.starts_at, b.ends_at)}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                  {b.notes && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">{b.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
