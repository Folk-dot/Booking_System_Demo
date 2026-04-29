import { useEffect, useState, useCallback } from 'react';
import { format, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import {
  getMyProfile,
  getMySchedules, upsertSchedule, deleteSchedule,
  getMyOverrides, upsertOverride, deleteOverride,
} from '@/api/dashApi.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 25 }, (_, i) => `${String(Math.floor(i / 2) + 7).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`).slice(0, 26); // 07:00–19:00 in 30-min steps

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

// ── Weekly Schedule Editor ───────────────────────────────────

function ScheduleEditor({ schedules, trainerId, tenantId, onRefresh }) {
  const [saving, setSaving] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [adding, setAdding] = useState(null); // day_of_week being added
  const [newWindow, setNewWindow] = useState({ start_time: '09:00', end_time: '17:00' });

  const byDay = Object.fromEntries(DAYS.map((_, i) => [i, schedules.filter((s) => s.day_of_week === i)]));

  async function handleAdd(dow) {
    setSaving(dow);
    try {
      await upsertSchedule({
        trainer_id:  trainerId,
        tenant_id:   tenantId,
        day_of_week: dow,
        start_time:  newWindow.start_time,
        end_time:    newWindow.end_time,
      });
      setAdding(null);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteSchedule(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="card">
      <h2 className="mb-4 font-semibold text-gray-900">Weekly Schedule</h2>
      <p className="mb-5 text-sm text-gray-500">Set your recurring availability. This repeats every week.</p>
      <div className="space-y-2">
        {DAYS.map((label, dow) => (
          <div key={dow} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <span className="w-10 text-sm font-medium text-gray-700">{label}</span>

            <div className="flex flex-wrap gap-2">
              {byDay[dow].map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm text-brand-700 ring-1 ring-brand-200">
                  <span>{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</span>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="ml-1 text-brand-400 hover:text-red-500"
                  >
                    {deleting === s.id ? '...' : '✕'}
                  </button>
                </div>
              ))}

              {adding === dow ? (
                <div className="flex items-center gap-2">
                  <select value={newWindow.start_time}
                    onChange={(e) => setNewWindow((w) => ({ ...w, start_time: e.target.value }))}
                    className="input py-1 text-sm">
                    {HOURS.map((h) => <option key={h}>{h}</option>)}
                  </select>
                  <span className="text-gray-400">–</span>
                  <select value={newWindow.end_time}
                    onChange={(e) => setNewWindow((w) => ({ ...w, end_time: e.target.value }))}
                    className="input py-1 text-sm">
                    {HOURS.map((h) => <option key={h}>{h}</option>)}
                  </select>
                  <button onClick={() => handleAdd(dow)} disabled={saving === dow}
                    className="btn-primary py-1 px-3 text-sm">
                    {saving === dow ? '...' : 'Add'}
                  </button>
                  <button onClick={() => setAdding(null)} className="btn-secondary py-1 px-3 text-sm">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(dow)}
                  className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-400 hover:border-brand-400 hover:text-brand-600"
                >
                  + Add window
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Override Calendar ────────────────────────────────────────

function OverrideCalendar({ overrides, trainerId, tenantId, onRefresh }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [editing, setEditing] = useState(null); // date string being edited
  const [form, setForm] = useState({ is_day_off: true, start_time: '09:00', end_time: '17:00', note: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const overrideByDate = Object.fromEntries(overrides.map((o) => [o.date, o]));

  function openEdit(dateStr, existing) {
    setEditing(dateStr);
    if (existing) {
      setForm({
        is_day_off: existing.is_day_off,
        start_time: existing.start_time?.slice(0, 5) || '09:00',
        end_time:   existing.end_time?.slice(0, 5)   || '17:00',
        note:       existing.note || '',
      });
    } else {
      setForm({ is_day_off: true, start_time: '09:00', end_time: '17:00', note: '' });
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await upsertOverride({
        trainer_id: trainerId,
        tenant_id:  tenantId,
        date:       editing,
        is_day_off: form.is_day_off,
        start_time: form.is_day_off ? null : form.start_time,
        end_time:   form.is_day_off ? null : form.end_time,
        note:       form.note || null,
      });
      setEditing(null);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteOverride(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Date Overrides</h2>
          <p className="text-sm text-gray-500">Block a day or set custom hours for specific dates.</p>
        </div>
        <div className="flex rounded-xl border border-gray-200 bg-white">
          <button onClick={() => setWeekStart((w) => subWeeks(w, 1))}
            className="px-3 py-2 text-gray-500 hover:text-gray-900">‹</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            className="border-x border-gray-200 px-3 py-2 text-xs font-medium text-gray-600">Today</button>
          <button onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="px-3 py-2 text-gray-500 hover:text-gray-900">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr  = format(day, 'yyyy-MM-dd');
          const override = overrideByDate[dateStr];
          const isPast   = dateStr < todayStr();

          return (
            <div key={dateStr} className="min-h-[90px]">
              <div className={`mb-2 rounded-lg px-2 py-1.5 text-center text-xs font-medium
                ${dateStr === todayStr() ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <div>{format(day, 'EEE')}</div>
                <div className="text-base font-bold">{format(day, 'd')}</div>
              </div>

              {override ? (
                <div className={`rounded-lg p-2 text-xs ring-1
                  ${override.is_day_off ? 'bg-red-50 ring-red-200 text-red-700' : 'bg-amber-50 ring-amber-200 text-amber-700'}`}>
                  {override.is_day_off ? 'Day off' : `${override.start_time?.slice(0,5)}–${override.end_time?.slice(0,5)}`}
                  {override.note && <p className="mt-0.5 truncate text-[10px] opacity-70">{override.note}</p>}
                  <div className="mt-1.5 flex gap-1">
                    {!isPast && (
                      <button onClick={() => openEdit(dateStr, override)}
                        className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 hover:text-brand-600">
                        Edit
                      </button>
                    )}
                    <button onClick={() => handleDelete(override.id)} disabled={deleting === override.id}
                      className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 ring-1 ring-gray-200 hover:text-red-600">
                      {deleting === override.id ? '...' : '✕'}
                    </button>
                  </div>
                </div>
              ) : !isPast ? (
                <button onClick={() => openEdit(dateStr, null)}
                  className="w-full rounded-lg border border-dashed border-gray-200 p-2 text-[11px] text-gray-400 hover:border-brand-300 hover:text-brand-500">
                  Override
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 font-semibold text-gray-900">Override — {editing}</h3>

            <div className="mb-4 flex gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" checked={form.is_day_off}
                  onChange={() => setForm((f) => ({ ...f, is_day_off: true }))} />
                Block day
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" checked={!form.is_day_off}
                  onChange={() => setForm((f) => ({ ...f, is_day_off: false }))} />
                Custom hours
              </label>
            </div>

            {!form.is_day_off && (
              <div className="mb-4 flex items-center gap-3">
                <select value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                  className="input py-1 text-sm">
                  {HOURS.map((h) => <option key={h}>{h}</option>)}
                </select>
                <span className="text-gray-400">–</span>
                <select value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="input py-1 text-sm">
                  {HOURS.map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">Note (optional)</label>
              <input value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Public holiday, personal event"
                className="input text-sm" />
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function Availability() {
  const [schedules, setSchedules] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [profile,   setProfile]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, scheds] = await Promise.all([getMyProfile(), getMySchedules()]);
      setProfile(prof);
      setSchedules(scheds);
      const from = format(new Date(), 'yyyy-MM-dd');
      const to   = format(addDays(new Date(), 60), 'yyyy-MM-dd');
      const ovrs = await getMyOverrides(from, to);
      setOverrides(ovrs);
    } catch {
      setError('Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner text="Loading availability..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set your weekly schedule, then override specific dates as needed.
        </p>
      </div>

      <ErrorMessage message={error} />

      {profile && (
        <>
          <ScheduleEditor
            schedules={schedules}
            trainerId={profile.id}
            tenantId={profile.tenant_id}
            onRefresh={load}
          />
          <OverrideCalendar
            overrides={overrides}
            trainerId={profile.id}
            tenantId={profile.tenant_id}
            onRefresh={load}
          />
        </>
      )}
    </div>
  );
}
