import express from 'express';
import { requireTrainer, requireTrainee, requireAuth } from '../middleware/auth.js';
import { login, liffAuth } from '../controllers/authController.js';
import { listTrainers, getTrainer, updateProfile } from '../controllers/trainerController.js';
import { getAvailableSlots, getTrainerSlots, createSlots, blockSlot, deleteSlot } from '../controllers/slotController.js';
import { createBooking, getMyBookings, getTrainerBookings, cancelBooking, rescheduleBooking } from '../controllers/bookingController.js';

const router = express.Router();

// ── Auth ────────────────────────────────────────────────────
router.post('/auth/login', login);
router.post('/auth/liff',  liffAuth);

// ── Trainers ────────────────────────────────────────────────
router.get('/trainers',     requireTrainee, listTrainers);
router.get('/trainers/:id', requireTrainee, getTrainer);
router.put('/trainers/me',  requireTrainer, updateProfile);

// ── Slots ────────────────────────────────────────────────────
router.get('/slots',            requireTrainee, getAvailableSlots);   // trainee: available slots for a trainer+date
router.get('/slots/trainer',    requireTrainer, getTrainerSlots);     // trainer: own slots with booking info
router.post('/slots',           requireTrainer, createSlots);
router.patch('/slots/:id/block',requireTrainer, blockSlot);
router.delete('/slots/:id',     requireTrainer, deleteSlot);

// ── Bookings ─────────────────────────────────────────────────
router.post('/bookings',                   requireTrainee, createBooking);
router.get('/bookings/me',                 requireTrainee, getMyBookings);
router.get('/bookings/trainer',            requireTrainer, getTrainerBookings);
router.patch('/bookings/:id/cancel',       requireAuth,    cancelBooking);
router.patch('/bookings/:id/reschedule',   requireTrainer, rescheduleBooking);

export default router;
