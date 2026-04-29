import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import liff from '@line/liff';
import { liffSignIn } from '@/api/liffApi.js';
import TrainerSelect from './pages/TrainerSelect.jsx';
import SlotPicker from './pages/SlotPicker.jsx';
import Confirm from './pages/Confirm.jsx';
import MyBookings from './pages/MyBookings.jsx';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function initLiff() {
      try {
        await liff.init({ liffId: import.meta.env.VITE_LIFF_ID, withLoginOnExternalBrowser: true });

        if (!liff.isLoggedIn()) {
          liff.login(); // redirects to LINE login
          return;
        }

        // Exchange LINE token for a Supabase session
        const accessToken = liff.getAccessToken();
        if (!accessToken) throw new Error('No LINE access token');
        await liffSignIn(accessToken);

        setReady(true);
      } catch (err) {
        console.error('[liff] init error:', err);
        setError('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่');
      }
    }

    initLiff();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-red-500 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-4">
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  if (!ready) return <LoadingSpinner text="กำลังเข้าสู่ระบบ..." />;

  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-md bg-white">
        <Routes>
          <Route path="/liff"                element={<TrainerSelect />} />
          <Route path="/slots/:trainerId"    element={<SlotPicker />} />
          <Route path="/confirm"             element={<Confirm />} />
          <Route path="/my-bookings"         element={<MyBookings />} />
          <Route path="*"                    element={<Navigate to="/liff" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
