import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { clearCache } from '../lib/cache'
import { weeksSince, getCurrentWeekStartStr } from '../lib/weekUtils'

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
  const [stats, setStats] = useState(null)
  const fileRef = useRef()

  const avatarUrl = profile?.avatar_url
  const initials = profile?.avatar_initials || profile?.name?.split(' ').map(w => w[0]).join('').toUpperCase() || '?'

  useEffect(() => {
    if (user) fetchStats()
  }, [user])

  async function fetchStats() {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
    const groupCount = memberships?.length || 0

    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, week_start')
      .eq('user_id', user.id)
    const commitmentIds = commitments?.map(c => c.id) || []

    let totalCheckins = 0
    let thisWeekCheckins = 0
    if (commitmentIds.length) {
      const { data: allCheckins } = await supabase
        .from('checkins')
        .select('commitment_id, day_of_week')
        .in('commitment_id', commitmentIds)
      totalCheckins = allCheckins?.length || 0

      // This week's check-ins (from current week's commitments)
      const weekStart = getCurrentWeekStartStr()
      const thisWeekIds = commitments?.filter(c => c.week_start === weekStart).map(c => c.id) || []
      thisWeekCheckins = allCheckins?.filter(ci => thisWeekIds.includes(ci.commitment_id)).length || 0
    }

    setStats({ groupCount, totalCheckins, thisWeekCheckins, weeksActive: weeksSince(profile?.created_at) })
  }

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
      .update({ name: form.name.trim(), bio: form.bio.trim(), location: form.location.trim() })
      .eq('id', user.id)

    if (updateError) { setError(updateError.message); setSaving(false); return }

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

      {/* Hero card: avatar + name */}
      <div className="bg-white border border-border rounded-xl shadow-card p-6 mb-4">
        <div className="flex items-center gap-5">
          <div className="relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
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
            {profile?.location && (
              <p className="text-sm text-text3 flex items-center gap-1 mt-0.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {profile.location}
              </p>
            )}
            {joinedDate && <p className="text-xs text-text3 mt-1">Member since {joinedDate}</p>}
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

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-0 mt-5 pt-5 border-t border-cream2">
            <div className="text-center">
              <p className="font-serif text-2xl text-burg leading-none">{stats.totalCheckins}</p>
              <p className="text-[10px] text-text3 mt-1 uppercase tracking-wider">Check-ins</p>
            </div>
            <div className="text-center border-x border-cream2">
              <p className="font-serif text-2xl text-burg leading-none">{stats.thisWeekCheckins}</p>
              <p className="text-[10px] text-text3 mt-1 uppercase tracking-wider">This week</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl text-burg leading-none">{stats.weeksActive}</p>
              <p className="text-[10px] text-text3 mt-1 uppercase tracking-wider">Weeks in</p>
            </div>
          </div>
        )}
      </div>

      {/* Bio + info / edit form */}
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
                placeholder="Barcelona, Spain"
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
            {profile?.bio ? (
              <div>
                <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">Bio</p>
                <p className="text-sm text-text leading-relaxed">{profile.bio}</p>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="text-sm text-text3 hover:text-burg transition-colors">
                + Add a bio
              </button>
            )}
            <div>
              <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">North Star</p>
              <p className="text-sm text-text font-serif italic">{profile?.north_star || <span className="text-text3 not-italic">Not set.</span>}</p>
            </div>
            {profile?.location && (
              <div>
                <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">Location</p>
                <p className="text-sm text-text">{profile.location}</p>
              </div>
            )}
          </div>
        )}
        {success && <p className="text-xs text-green-600 mt-3">{success}</p>}
      </div>

      {/* Account */}
      <div className="bg-white border border-border rounded-xl shadow-card p-6">
        <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-4">Account</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-text2 uppercase tracking-wider font-medium mb-1">Email</p>
            <p className="text-sm text-text">{user?.email}</p>
          </div>
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
