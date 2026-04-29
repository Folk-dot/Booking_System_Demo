import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Login from './pages/Login.jsx';
import Bookings from './pages/Bookings.jsx';
import Availability from './pages/Availability.jsx';
import Profile from './pages/Profile.jsx';
import Layout from './components/Layout.jsx';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';

function RequireAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <LoadingSpinner text="Loading..." />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/bookings" replace />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/availability" element={<Availability />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
