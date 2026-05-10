import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTrainers } from '@/api/liffApi.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

export default function TrainerSelect() {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    listTrainers()
      .then(setTrainers)
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="กำลังโหลด..." />;

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="border-b border-gray-100 px-5 pb-4 pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Booking</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Select a trainer</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <ErrorMessage message={error} />

        <div className="space-y-2">
          {trainers.map(trainer => (
            <button
              key={trainer.id}
              onClick={() => navigate(`/slots/${trainer.id}`, { state: { trainer } })}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-400 hover:bg-gray-50 active:scale-[0.99]"
            >
              {trainer.avatar_url ? (
                <img
                  src={trainer.avatar_url}
                  alt={trainer.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900 text-base font-semibold text-white">
                  {trainer.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{trainer.name}</p>
                {trainer.specialty && (
                  <p className="mt-0.5 text-xs text-gray-500">{trainer.specialty}</p>
                )}
                {trainer.bio && (
                  <p className="mt-1 line-clamp-1 text-xs text-gray-400">{trainer.bio}</p>
                )}
              </div>
              <svg className="h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/my-bookings')}
          className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
        >
          View my bookings
        </button>
      </div>
    </div>
  );
}
