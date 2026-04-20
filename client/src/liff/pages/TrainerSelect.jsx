import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import liffApi from '@/api/liffApi.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

export default function TrainerSelect() {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    liffApi
      .get('/trainers')
      .then((r) => setTrainers(r.data))
      .catch(() => setError('โหลดข้อมูลเทรนเนอร์ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="กำลังโหลดเทรนเนอร์..." />;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">เลือกเทรนเนอร์</h1>
        <p className="mt-1 text-sm text-gray-500">เลือกเทรนเนอร์เพื่อดูเวลาว่าง</p>
      </div>

      <ErrorMessage message={error} />

      <div className="space-y-3">
        {trainers.map((trainer) => (
          <button
            key={trainer.id}
            onClick={() => navigate(`/slots/${trainer.id}`, { state: { trainer } })}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left
                       shadow-sm ring-1 ring-gray-100 transition hover:ring-brand-400 active:scale-[0.98]"
          >
            {trainer.avatar_url ? (
              <img
                src={trainer.avatar_url}
                alt={trainer.name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                {trainer.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">{trainer.name}</p>
              {trainer.specialty && (
                <p className="mt-0.5 text-xs font-medium text-brand-600">{trainer.specialty}</p>
              )}
              {trainer.bio && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{trainer.bio}</p>
              )}
            </div>
            <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* My bookings link */}
      <button
        onClick={() => navigate('/my-bookings')}
        className="mt-6 w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        ดูการจองของฉัน
      </button>
    </div>
  );
}
