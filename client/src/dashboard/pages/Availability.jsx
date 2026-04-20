import { useEffect, useState, useCallback } from 'react';
import { format, addDays, startOfDay, addWeeks, subWeeks } from 'date-fns';
import { toBkkDateStr, formatTime } from '@/shared/utils/dateUtils.js';
import dashApi from '@/api/dashApi.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00–19:00

function weekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export default function Availability() {
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [blockingId, setBlockingId] = useState(null);

  // New slot form state
  const [newSlot, setNewSlot] = useState({ date: '', startHour: '9', durationH: '1' });
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');

  const days = weekDays(weekStart);

  const load = useCallback(() => {
    setLoading(true);
    const from = new Date(`${toBkkDateStr(days[0])}T00:00:00+07:00`).toISOString();
    const to   = new Date(`${toBkkDateStr(days[6])}T23:59:59+07:00`).toISOString();
    dashApi
      .get('/slots/trainer', { params: { from, to } })
      .then((r) => setSlots(r.data))
      .catch(() => setError('Failed to load slots'))
      .finally(() => setLoading(false));
  }, [weekStart]);  // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    if (!newSlot.date) { setFormError('Select a date'); return; }
    const startsAt = new Date(`${newSlot.date}T${String(newSlot.startHour).padStart(2, '0')}:00:00+07:00`).toISOString();
    const endsAt   = new Date(`${newSlot.date}T${String(Number(newSlot.startHour) + Number(newSlot.durationH)).padStart(2, '0')}:00:00+07:00`).toISOString();
    setCreating(true);
    try {
      await dashApi.post('/slots', { slots: [{ startsAt, endsAt }] });
      setShowForm(false);
      setNewSlot({ date: '', startHour: '9', durationH: '1' });
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create slot');
    } finally {
      setCreating(false);
    }
  }

  async function handleBlock(slotId) {
    setBlockingId(slotId);
    try {
      await dashApi.patch(`/slots/${slotId}/block`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to block slot');
    } finally {
      setBlockingId(null);
    }
  }

  async function handleDelete(slotId) {
    if (!confirm('Delete this slot?')) return;
    try {
      await dashApi.delete(`/slots/${slotId}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete slot');
    }
  }

  // Group slots by date string (Bangkok)
  const slotsByDate = slots.reduce((acc, s) => {
    const key = format(new Date(s.startsAt), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="mt-1 text-sm text-gray-500">
            {format(days[0], 'd MMM')} – {format(days[6], 'd MMM yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-gray-200 bg-white">
            <button onClick={() => setWeekStart((w) => subWeeks(w, 1))}
              className="px-3 py-2 text-gray-500 hover:text-gray-900">‹</button>
            <button onClick={() => setWeekStart(startOfDay(new Date()))}
              className="border-x border-gray-200 px-3 py-2 text-xs font-medium text-gray-600">Today</button>
            <button onClick={() => setWeekStart((w) => addWeeks(w, 1))}
              className="px-3 py-2 text-gray-500 hover:text-gray-900">›</button>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + Add slot
          </button>
        </div>
      </div>

      <ErrorMessage message={error} />

      {/* Add slot form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="mb-4 font-semibold text-gray-900">New availability slot</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Date</label>
              <input type="date" value={newSlot.date}
                onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))}
                min={toBkkDateStr(new Date())} className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
              <select value={newSlot.startHour}
                onChange={(e) => setNewSlot((s) => ({ ...s, startHour: e.target.value }))}
                className="input">
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Duration</label>
              <select value={newSlot.durationH}
                onChange={(e) => setNewSlot((s) => ({ ...s, durationH: e.target.value }))}
                className="input">
                {[1, 1.5, 2].map((d) => (
                  <option key={d} value={d}>{d}h</option>
                ))}
              </select>
            </div>
            {formError && <div className="sm:col-span-4"><ErrorMessage message={formError} /></div>}
            <div className="flex gap-2 sm:col-span-4">
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Saving...' : 'Save slot'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Weekly grid */}
      {loading ? (
        <LoadingSpinner text="Loading slots..." />
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const key = toBkkDateStr(day);
            const daySlots = slotsByDate[key] || [];
            const isToday = key === toBkkDateStr(new Date());
            return (
              <div key={key} className="min-h-[120px]">
                <div className={`mb-2 rounded-lg px-2 py-1.5 text-center text-xs font-medium
                  ${isToday ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <div>{format(day, 'EEE')}</div>
                  <div className="text-base font-bold">{format(day, 'd')}</div>
                </div>
                <div className="space-y-1.5">
                  {daySlots.map((slot) => (
                    <div key={slot.id}
                      className={`rounded-lg p-2 text-xs
                        ${slot.isBlocked ? 'bg-red-50 ring-1 ring-red-200'
                          : slot.booking ? 'bg-blue-50 ring-1 ring-blue-200'
                          : 'bg-brand-50 ring-1 ring-brand-200'}`}>
                      <p className="font-semibold">
                        {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
                      </p>
                      {slot.booking && (
                        <p className="mt-0.5 truncate text-blue-700">{slot.booking.trainee.name}</p>
                      )}
                      {slot.isBlocked && <p className="text-red-600">Blocked</p>}
                      {!slot.booking && !slot.isBlocked && (
                        <div className="mt-1.5 flex gap-1">
                          <button onClick={() => handleBlock(slot.id)} disabled={blockingId === slot.id}
                            className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500
                                       ring-1 ring-gray-200 hover:text-red-500">
                            Block
                          </button>
                          <button onClick={() => handleDelete(slot.id)}
                            className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500
                                       ring-1 ring-gray-200 hover:text-red-600">
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
