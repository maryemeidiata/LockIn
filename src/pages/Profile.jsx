import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { clearCache } from '../lib/cache'

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [form, setForm] = useState({
    name: profile?.name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef()

  const avatarUrl = profile?.avatar_url
  const initials = profile?.avatar_initials || profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase() || '?'

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Failed to upload photo: ' + uploadError.message)
      setUploadingPhoto(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
    await refreshProfile()
    clearCache('overview')
    setUploadingPhoto(false)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('users')
      .update({
        name: form.name.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    await refreshProfile()
    clearCache('overview')
    clearCache('groups')
    setSaving(false)
    setEditing(false)
    setSuccess('Profile updated.')
    setTimeout(() => setSuccess(''), 3000)
  }

  function handleCancel() {
    setForm({ name: profile?.name || '', bio: profile?.bio || '', location: profile?.location || '' })
    setEditing(false)
    setError('')
  }

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-serif text-[26px] text-text tracking-tight mb-6">Profile</h1>

      {/* Avatar + photo upload */}
      <div className="bg-white border border-border rounded-xl shadow-card p-6 mb-4">
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-burg flex items-center justify-center text-cream font-semibold text-2xl border-2 border-border">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-border rounded-full flex items-center justify-center hover:bg-cream2 transition-colors shadow-sm"
              title="Change photo"
            >
              {uploadingPhoto ? (
                <span className="text-[9px] text-text3">...</span>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-serif text-xl text-text">{profile?.name}</p>
            <p className="text-sm text-text3">{user?.email}</p>
            {joinedDate && <p className="text-xs text-text3 mt-1">Joined {joinedDate}</p>}
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs font-medium text-text2 bg-cream2 border border-border rounded-[8px] hover:bg-cream3 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Info fields */}
      <div className="bg-white border border-border rounded-xl shadow-card p-6 mb-4">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Full name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="A few words about you..."
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg resize-none placeholder-text3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Location</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="London, UK"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg placeholder-text3"
              />
            </div>
            {error && <p className="text-xs text-burg">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={handleCancel} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Bio" value={profile?.bio} placeholder="No bio yet." />
            <Field label="Location" value={profile?.location} placeholder="Not set." />
            <Field label="North Star" value={profile?.north_star} placeholder="Not set." />
          </div>
        )}
        {success && <p className="text-xs text-green-600 mt-3">{success}</p>}
      </div>

      {/* Account info */}
      <div className="bg-white border border-border rounded-xl shadow-card p-6">
        <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-4">Account</p>
        <div className="space-y-3">
          <Field label="Email" value={user?.email} />
          <div>
            <p className="text-xs text-text2 uppercase tracking-wider font-medium mb-1">Password</p>
            <button
              onClick={async () => {
                await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: 'https://lockin-app-azure.vercel.app/profile' })
                setSuccess('Password reset email sent.')
                setTimeout(() => setSuccess(''), 4000)
              }}
              className="text-xs text-burg hover:underline"
            >
              Send reset email
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, placeholder = '—' }) {
  return (
    <div>
      <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-text">{value || <span className="text-text3">{placeholder}</span>}</p>
    </div>
  )
}
