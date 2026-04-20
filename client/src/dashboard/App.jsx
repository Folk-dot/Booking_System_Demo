import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Bookings from './pages/Bookings.jsx';
import Availability from './pages/Availability.jsx';
import Profile from './pages/Profile.jsx';
import Layout from './components/Layout.jsx';

function RequireAuth() {
  const token = localStorage.getItem('trainer_token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
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
