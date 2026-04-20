import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TrainerSelect from './pages/TrainerSelect.jsx';
import SlotPicker from './pages/SlotPicker.jsx';
import Confirm from './pages/Confirm.jsx';
import MyBookings from './pages/MyBookings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-md bg-white">
        <Routes>
          <Route path="/" element={<TrainerSelect />} />
          <Route path="/slots/:trainerId" element={<SlotPicker />} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
