import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase.js';
import { getMyProfile, updateMyProfile } from '@/api/dashApi.js';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';
import LoadingSpinner from '@/shared/components/LoadingSpinner.jsx';

export default function Profile() {
  const [form, setForm] = useState({ name: '', bio: '', specialty: '', avatar_url: '' });
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [pwError, setPwError]   = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    getMyProfile()
      .then((p) => setForm({ name: p.name || '', bio: p.bio || '', specialty: p.specialty || '', avatar_url: p.avatar_url || '' }))
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      await updateMyProfile({
        name:      form.name,
        bio:       form.bio || null,
        specialty: form.specialty || null,
        avatar_url: form.avatar_url || null,
      });
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword });
      if (error) throw error;
      setPwForm({ newPassword: '', confirmPassword: '' });
      setPwSuccess('Password updated successfully');
    } catch (err) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  }

  if (loading) return <LoadingSpinner text="Loading profile..." />;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* Basic info */}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Basic info</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
          <input name="name" value={form.name} onChange={handleChange} required className="input" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Specialty</label>
          <input name="specialty" value={form.specialty} onChange={handleChange}
            placeholder="e.g. Muay Thai, Yoga, Strength Training" className="input" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange}
            rows={3} className="input resize-none" placeholder="Tell trainees about yourself..." />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Avatar URL</label>
          <input name="avatar_url" value={form.avatar_url} onChange={handleChange}
            type="url" placeholder="https://..." className="input" />
          {form.avatar_url && (
            <img src={form.avatar_url} alt="Preview"
              className="mt-2 h-16 w-16 rounded-full object-cover ring-2 ring-gray-100" />
          )}
        </div>

        <ErrorMessage message={error} />
        {success && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">{success}</div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {/* Password change */}
      <form onSubmit={handlePasswordChange} className="card space-y-4">
        <h2 className="font-semibold text-gray-900">
          Change password <span className="text-xs font-normal text-gray-400">(optional)</span>
        </h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
          <input type="password" value={pwForm.newPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
            autoComplete="new-password" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm new password</label>
          <input type="password" value={pwForm.confirmPassword}
            onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            autoComplete="new-password" className="input" />
        </div>

        <ErrorMessage message={pwError} />
        {pwSuccess && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">{pwSuccess}</div>
        )}

        <button type="submit" disabled={savingPw} className="btn-primary w-full">
          {savingPw ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
