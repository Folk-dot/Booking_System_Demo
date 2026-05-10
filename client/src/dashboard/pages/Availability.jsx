import { useEffect, useState, useCallback } from 'react';
import {
  format, addDays, startOfDay, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isBefore, addMonths, subMonths,
} from 'date-fns';
import {
  getMyProfile,
  getMySchedules, upsertSchedule, deleteSchedule,
  getMyOverrides, upsertOverride, deleteOverride,
} from '@/api/dashApi.js';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

const DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 25 }, (_, i) =>
  `${String(Math.floor(i / 2) + 7).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`
).slice(0, 26);
const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ── Shared primitives ─────────────────────────────────────────

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200
        ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200
        ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function TimeSelect({ value, onChange, className = 'w-24' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-gray-200 bg-white pl-3 pr-7 py-1.5 text-base text-gray-700 focus:border-gray-400 focus:outline-none ${className}`}
    >
      {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
    </select>
  );
}

function IconBtn({ onClick, disabled, title, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition
        ${danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-gray-100 hover:text-gray-700'}
        disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

// ── Calendar for override modal ───────────────────────────────

function OverrideCalendarPicker({ selectedDate, onSelectDate, overridesByDate = {} }) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(new Date()));
  const today = startOfDay(new Date());

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end:   endOfWeek(endOfMonth(viewMonth)),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          {format(viewMonth, 'MMMM')}{' '}
          <span className="font-normal text-gray-400">{format(viewMonth, 'yyyy')}</span>
        </span>
        <div className="flex gap-1">
          <IconBtn onClick={() => setViewMonth(subMonths(viewMonth, 1))} title="Previous month">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </IconBtn>
          <IconBtn onClick={() => setViewMonth(addMonths(viewMonth, 1))} title="Next month">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </IconBtn>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {DAY_HEADERS.map(d => (
          <div key={d} className="py-1.5 text-center text-[10px] font-medium tracking-wide text-gray-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isOutside    = !isSameMonth(day, viewMonth);
          const isSelected   = selectedDate && isSameDay(day, selectedDate);
          const isToday      = isSameDay(day, today);
          const isPast       = isBefore(day, today) && !isToday;
          const dateStr      = format(day, 'yyyy-MM-dd');
          const hasOverride  = !!overridesByDate[dateStr];

          if (isOutside) return <div key={day.toISOString()} />;

          return (
            <button
              key={day.toISOString()}
              onClick={() => !isPast && onSelectDate(day)}
              disabled={isPast}
              className={[
                'relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition',
                isSelected ? 'bg-gray-900 font-semibold text-white' : '',
                !isSelected && isToday ? 'bg-gray-100 font-semibold text-gray-900 ring-2 ring-inset ring-gray-900' : '',
                !isSelected && !isToday && !isPast ? 'bg-gray-100 text-gray-700 hover:bg-gray-900 hover:text-white' : '',
                isPast ? 'cursor-not-allowed text-gray-200' : '',
              ].filter(Boolean).join(' ')}
            >
              {format(day, 'd')}
              {hasOverride && !isSelected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Weekly Schedule Editor ────────────────────────────────────

function ScheduleEditor({ schedules, trainerId, tenantId, onRefresh }) {
  const [busy, setBusy] = useState(null);

  const byDay = Object.fromEntries(
    DAYS.map((_, i) => [i, schedules.filter((s) => s.day_of_week === i)])
  );

  async function handleToggle(dow, isOn) {
    setBusy(`toggle-${dow}`);
    try {
      if (isOn) {
        await Promise.all(byDay[dow].map(s => deleteSchedule(s.id)));
      } else {
        await upsertSchedule({ trainer_id: trainerId, tenant_id: tenantId, day_of_week: dow, start_time: '09:00', end_time: '17:00' });
      }
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setBusy(null); }
  }

  async function handleAddWindow(dow) {
    setBusy(`add-${dow}`);
    try {
      await upsertSchedule({ trainer_id: trainerId, tenant_id: tenantId, day_of_week: dow, start_time: '09:00', end_time: '17:00' });
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setBusy(null); }
  }

  async function handleDelete(id) {
    setBusy(`del-${id}`);
    try {
      await deleteSchedule(id);
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setBusy(null); }
  }

  async function handleTimeChange(s, field, value) {
    try {
      await upsertSchedule({
        id:          s.id,
        trainer_id:  trainerId,
        tenant_id:   tenantId,
        day_of_week: s.day_of_week,
        start_time:  field === 'start_time' ? value : s.start_time,
        end_time:    field === 'end_time'   ? value : s.end_time,
      });
      onRefresh();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="font-semibold text-gray-900">Weekly hours</h2>
        <p className="mt-0.5 text-sm text-gray-400">Set your recurring availability. Repeats every week.</p>
      </div>

      <div className="divide-y divide-gray-100">
        {DAYS.map((label, dow) => {
          const windows = byDay[dow];
          const isOn    = windows.length > 0;

          return (
            <div key={dow} className="px-5 py-4 sm:flex sm:items-start sm:gap-3">
              {/* Toggle + day label */}
              <div className="flex items-center gap-3 sm:w-28 sm:shrink-0 sm:pt-1">
                <Toggle checked={isOn} onChange={() => handleToggle(dow, isOn)} />
                <span className={`text-sm font-medium ${isOn ? 'text-gray-800' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>

              {/* Time windows */}
              <div className="min-w-0 flex-1">
                {isOn ? (
                  <div className="mt-2.5 space-y-2 sm:mt-0">
                    {windows.map((s, idx) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <TimeSelect
                          value={s.start_time.slice(0, 5)}
                          onChange={(v) => handleTimeChange(s, 'start_time', v)}
                          className="w-24 shrink-0"
                        />
                        <span className="shrink-0 text-xs text-gray-300">–</span>
                        <TimeSelect
                          value={s.end_time.slice(0, 5)}
                          onChange={(v) => handleTimeChange(s, 'end_time', v)}
                          className="w-24 shrink-0"
                        />
                        {idx === 0 && (
                          <IconBtn onClick={() => handleAddWindow(dow)} disabled={busy === `add-${dow}`} title="Add window">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </IconBtn>
                        )}
                        <IconBtn onClick={() => handleDelete(s.id)} disabled={busy === `del-${s.id}`} title="Remove" danger>
                          {busy === `del-${s.id}` ? (
                            <span className="text-xs">…</span>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </IconBtn>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-300 sm:mt-0 sm:pt-1">Unavailable</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Override Section ──────────────────────────────────────────

function OverrideSection({ overrides, trainerId, tenantId, onRefresh }) {
  const overridesByDate = Object.fromEntries(overrides.map(o => [o.date, o]));
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayOff, setIsDayOff]         = useState(false);
  const [windows, setWindows]           = useState([{ start_time: '09:00', end_time: '17:00' }]);
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(null);

  function openModal() {
    setSelectedDate(null);
    setIsDayOff(false);
    setWindows([{ start_time: '09:00', end_time: '17:00' }]);
    setShowModal(true);
  }

  function handleDateSelect(day) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const existing = overridesByDate[dateStr];
    setSelectedDate(day);
    if (existing) {
      setIsDayOff(existing.is_day_off);
      setWindows([{
        start_time: existing.start_time?.slice(0, 5) || '09:00',
        end_time:   existing.end_time?.slice(0, 5)   || '17:00',
      }]);
    } else {
      setIsDayOff(false);
      setWindows([{ start_time: '09:00', end_time: '17:00' }]);
    }
  }

  async function handleSave() {
    if (!selectedDate) return;
    setSaving(true);
    try {
      await upsertOverride({
        trainer_id: trainerId,
        tenant_id:  tenantId,
        date:       format(selectedDate, 'yyyy-MM-dd'),
        is_day_off: isDayOff,
        start_time: isDayOff ? null : windows[0].start_time,
        end_time:   isDayOff ? null : windows[0].end_time,
        note:       null,
      });
      setShowModal(false);
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteOverride(id);
      onRefresh();
    } catch (err) { alert(err.message); }
    finally { setDeleting(null); }
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">Date overrides</h2>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="mt-0.5 text-sm text-gray-400">Add dates when your availability changes from your weekly hours.</p>
        </div>

        <div className="px-6 py-4">
          {overrides.length > 0 && (
            <div className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {overrides.map(o => (
                <div key={o.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{format(new Date(o.date + 'T00:00:00'), 'EEE, d MMM yyyy')}</p>
                    <p className="text-xs text-gray-400">
                      {o.is_day_off ? 'Unavailable all day' : `${o.start_time?.slice(0, 5)} – ${o.end_time?.slice(0, 5)}`}
                    </p>
                  </div>
                  <IconBtn onClick={() => handleDelete(o.id)} disabled={deleting === o.id} title="Remove" danger>
                    {deleting === o.id ? <span className="text-xs">…</span> : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </IconBtn>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={openModal}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add an override
          </button>
        </div>
      </div>

      {/* Override modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, marginTop: 0 }} className="flex items-end justify-center bg-black/50 sm:items-center">
          <div className="flex w-full max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            {/* Sticky header */}
            <div className="shrink-0 border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">Date override</h3>
              <p className="mt-0.5 text-xs text-gray-400">Select a date then configure hours below</p>
            </div>

            {/* Scrollable content */}
            <div className="flex flex-1 flex-col overflow-y-auto sm:flex-row sm:divide-x divide-gray-100">
              {/* Top / Left: calendar picker */}
              <div className="flex-1 p-6">
                <OverrideCalendarPicker selectedDate={selectedDate} onSelectDate={handleDateSelect} overridesByDate={overridesByDate} />
              </div>

              {/* Bottom / Right: hours config */}
              <div className="border-t border-gray-100 p-6 sm:w-72 sm:border-t-0">
                <p className="mb-4 text-sm font-semibold text-gray-900">Which hours are you free?</p>

                {!isDayOff && (
                  <div className="mb-5 space-y-2">
                    {windows.map((w, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <TimeSelect
                          value={w.start_time}
                          onChange={(v) => setWindows(ws => ws.map((x, j) => j === i ? { ...x, start_time: v } : x))}
                        />
                        <span className="text-sm text-gray-400">-</span>
                        <TimeSelect
                          value={w.end_time}
                          onChange={(v) => setWindows(ws => ws.map((x, j) => j === i ? { ...x, end_time: v } : x))}
                        />
                        <IconBtn
                          onClick={() => i === 0
                            ? setWindows(ws => [...ws, { start_time: '09:00', end_time: '17:00' }])
                            : setWindows(ws => ws.filter((_, j) => j !== i))
                          }
                          title={i === 0 ? 'Add window' : 'Remove'}
                          danger={i > 0}
                        >
                          {i === 0 ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </IconBtn>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Toggle checked={isDayOff} onChange={setIsDayOff} />
                  <span className="text-sm text-gray-600">Mark unavailable (All day)</span>
                </div>
              </div>
            </div>{/* end scrollable content */}

            {/* Sticky footer */}
            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Close</button>
              <button onClick={handleSave} disabled={!selectedDate || saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function Availability() {
  const [schedules, setSchedules] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [profile, setProfile]     = useState(null);
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
      setOverrides(await getMyOverrides(from, to));
    } catch {
      setError('Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner text="Loading..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set your weekly schedule and override specific dates as needed.
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
          <OverrideSection
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
