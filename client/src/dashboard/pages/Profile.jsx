import { useState, useEffect } from 'react';
import dashApi from '@/api/dashApi.js';
import ErrorMessage from '@/shared/components/ErrorMessage.jsx';

export default function Profile() {
  const stored = JSON.parse(localStorage.getItem('trainer_user') || '{}');
  const [form, setForm] = useState({
    name: stored.name || '',
    bio: '',
    specialty: '',
    avatarUrl: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    dashApi
      .get(`/trainers/${stored.id}`)
      .then((r) => {
        setForm((f) => ({
          ...f,
          name: r.data.name || '',
          bio: r.data.bio || '',
          specialty: r.data.specialty || '',
          avatarUrl: r.data.avatar_url || '',
        }));
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        bio: form.bio || null,
        specialty: form.specialty || null,
        avatarUrl: form.avatarUrl || null,
      };
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const { data } = await dashApi.put('/trainers/me', payload);

      // Update local cache
      const updated = { ...stored, name: data.name };
      localStorage.setItem('trainer_user', JSON.stringify(updated));

      setForm((f) => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading...</div>;

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card space-y-4">
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
              rows={3} className="input resize-none"
              placeholder="Tell trainees about yourself..." />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Avatar URL</label>
            <input name="avatarUrl" value={form.avatarUrl} onChange={handleChange}
              type="url" placeholder="https://..." className="input" />
            {form.avatarUrl && (
              <img src={form.avatarUrl} alt="Preview"
                className="mt-2 h-16 w-16 rounded-full object-cover ring-2 ring-gray-100" />
            )}
          </div>
        </div>

        {/* Password change */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Change password <span className="text-xs font-normal text-gray-400">(optional)</span></h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Current password</label>
            <input type="password" name="currentPassword" value={form.currentPassword}
              onChange={handleChange} autoComplete="current-password" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
            <input type="password" name="newPassword" value={form.newPassword}
              onChange={handleChange} autoComplete="new-password" className="input" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm new password</label>
            <input type="password" name="confirmPassword" value={form.confirmPassword}
              onChange={handleChange} autoComplete="new-password" className="input" />
          </div>
        </div>

        <ErrorMessage message={error} />

        {success && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
            {success}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
