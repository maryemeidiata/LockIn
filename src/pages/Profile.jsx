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
    north_star: profile?.north_star || '',
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
    const groupIds = memberships?.map(m => m.group_id) || []
    let totalCheckins = 0
    let thisWeekCheckins = 0

    if (groupIds.length) {
      const weekStart = getCurrentWeekStartStr()
      const { data: myCommitments } = await supabase
        .from('commitments')
        .select('id, week_start')
        .eq('user_id', user.id)
        .in('group_id', groupIds)

      const myCommitmentIds = myCommitments?.map(c => c.id) || []
      if (myCommitmentIds.length) {
        const { data: allCheckins } = await supabase
          .from('checkins')
          .select('commitment_id, day_of_week')
          .in('commitment_id', myCommitmentIds)
        totalCheckins = allCheckins?.length || 0
        const thisWeekIds = new Set(myCommitments?.filter(c => c.week_start === weekStart).map(c => c.id) || [])
        thisWeekCheckins = allCheckins?.filter(ci => thisWeekIds.has(ci.commitment_id)).length || 0
      }
    }

    setStats({ groupCount: memberships?.length || 0, totalCheckins, thisWeekCheckins, weeksActive: weeksSince(profile?.created_at) })
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
    if (uploadError) { setError('Failed to upload photo: ' + uploadError.message); setUploadingPhoto(false); return }
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
      .update({ name: form.name.trim(), bio: form.bio.trim(), location: form.location.trim(), north_star: form.north_star.trim() })
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
    setForm({ name: profile?.name || '', bio: profile?.bio || '', location: profile?.location || '', north_star: profile?.north_star || '' })
    setEditing(false)
    setError('')
  }

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-card-md mb-0">
        <svg viewBox="0 0 1200 160" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%' }}>
          <defs>
            <linearGradient id="pb-sky" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2A0A14" />
              <stop offset="60%" stopColor="#4A1228" />
              <stop offset="100%" stopColor="#7A2442" />
            </linearGradient>
            <radialGradient id="pb-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FAF6F1" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#FAF6F1" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height="160" fill="url(#pb-sky)" />
          <ellipse cx="900" cy="55" rx="90" ry="90" fill="url(#pb-glow)" />
          <circle cx="900" cy="52" r="28" fill="#FAF6F1" opacity="0.09" />
          <g stroke="white" strokeWidth="0.5" opacity="0.15">
            <line x1="80" y1="25" x2="145" y2="44" />
            <line x1="145" y1="44" x2="210" y2="20" />
            <line x1="700" y1="30" x2="770" y2="46" />
            <line x1="770" y1="46" x2="845" y2="26" />
          </g>
          <circle cx="80" cy="25" r="1.8" fill="white" opacity="0.85" />
          <circle cx="145" cy="44" r="1.3" fill="white" opacity="0.7" />
          <circle cx="210" cy="20" r="1.3" fill="white" opacity="0.75" />
          <circle cx="280" cy="35" r="2" fill="white" opacity="0.85" />
          <circle cx="420" cy="22" r="1" fill="white" opacity="0.5" />
          <circle cx="540" cy="38" r="1.5" fill="white" opacity="0.65" />
          <circle cx="620" cy="18" r="1" fill="white" opacity="0.5" />
          <circle cx="700" cy="30" r="2" fill="white" opacity="0.85" />
          <circle cx="770" cy="46" r="1.3" fill="white" opacity="0.65" />
          <circle cx="845" cy="26" r="1.8" fill="white" opacity="0.8" />
          <circle cx="1010" cy="65" r="0.9" fill="white" opacity="0.45" />
          <circle cx="1090" cy="35" r="1.8" fill="white" opacity="0.75" />
          <circle cx="1160" cy="50" r="1.3" fill="white" opacity="0.6" />
          <g transform="translate(480,36)" opacity="0.9">
            <line x1="0" y1="-7" x2="0" y2="7" stroke="white" strokeWidth="1.2" opacity="0.5" />
            <line x1="-7" y1="0" x2="7" y2="0" stroke="white" strokeWidth="1.2" opacity="0.5" />
            <circle cx="0" cy="0" r="2.2" fill="white" />
          </g>
          <path d="M0,160 L0,110 Q80,90 160,105 Q240,92 330,75 Q410,60 490,78 Q570,95 650,75 Q730,55 820,72 Q910,88 1000,68 Q1080,50 1200,62 L1200,160 Z" fill="#3A0F1E" opacity="0.7" />
          <path d="M0,160 L0,138 Q100,122 220,136 Q340,122 460,110 Q560,100 640,118 Q720,136 820,112 Q920,90 1040,112 Q1120,128 1200,110 L1200,160 Z" fill="#2A0A14" opacity="0.9" />
        </svg>

        {/* Edit button top-right */}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="absolute top-4 right-4 px-3 py-1.5 text-xs font-medium text-white bg-white/15 border border-white/25 rounded-[8px] hover:bg-white/25 transition-colors"
          >
            Edit profile
          </button>
        )}
      </div>

      {/* Avatar — overlaps banner */}
      <div className="px-6 -mt-10 mb-4 flex items-end justify-between">
        <div className="relative">
          <div className="ring-4 ring-cream rounded-full">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-burg flex items-center justify-center text-cream font-semibold text-2xl">
                {initials}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-white border border-border rounded-full flex items-center justify-center hover:bg-cream2 transition-colors shadow-sm"
            title="Change photo"
          >
            {uploadingPhoto ? (
              <span className="text-[9px] text-text3">...</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Name + location to the right of avatar */}
        <div className="flex-1 ml-4 pb-1">
          <p className="font-serif text-xl text-text">{profile?.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {profile?.location && (
              <p className="text-sm text-text3 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {profile.location}
              </p>
            )}
            {joinedDate && <p className="text-xs text-text3">Member since {joinedDate}</p>}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="mx-0 mb-5 bg-white border border-border rounded-xl shadow-card">
          <div className="grid grid-cols-4 divide-x divide-border">
            {[
              { value: stats.totalCheckins, label: 'Total check-ins' },
              { value: stats.thisWeekCheckins, label: 'This week' },
              { value: stats.weeksActive, label: 'Weeks active' },
              { value: stats.groupCount, label: 'Groups' },
            ].map(s => (
              <div key={s.label} className="text-center py-4">
                <p className="font-serif text-2xl text-burg leading-none">{s.value}</p>
                <p className="text-[10px] text-text3 mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr,320px] lg:gap-5">

        {/* Left: bio + edit form */}
        <div className="bg-white border border-border rounded-xl shadow-card p-6 mb-4 lg:mb-0">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Full name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Bio</label>
                <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3}
                  placeholder="A few words about you..."
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg resize-none placeholder-text3" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Location</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Barcelona, Spain"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg placeholder-text3" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">North Star</label>
                <textarea value={form.north_star} onChange={e => setForm(f => ({ ...f, north_star: e.target.value }))} rows={3}
                  placeholder="The honest motivation behind everything you're working on..."
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg resize-none placeholder-text3 font-serif italic" />
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
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-semibold text-text2 uppercase tracking-widest mb-1.5">Bio</p>
                {profile?.bio ? (
                  <p className="text-sm text-text leading-relaxed">{profile.bio}</p>
                ) : (
                  <button onClick={() => setEditing(true)} className="text-sm text-text3 hover:text-burg transition-colors">+ Add a bio</button>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-text2 uppercase tracking-widest mb-1.5">North Star</p>
                <p className="text-sm text-text font-serif italic leading-relaxed">
                  {profile?.north_star || <span className="text-text3 not-italic font-sans">Not set.</span>}
                </p>
              </div>

              {profile?.location && (
                <div>
                  <p className="text-[10px] font-semibold text-text2 uppercase tracking-widest mb-1.5">Location</p>
                  <p className="text-sm text-text">{profile.location}</p>
                </div>
              )}
            </div>
          )}
          {success && <p className="text-xs text-green-600 mt-4">{success}</p>}
        </div>

        {/* Right: account settings */}
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl shadow-card p-6">
            <p className="text-[10px] font-semibold text-text2 uppercase tracking-widest mb-4">Account</p>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-text3 uppercase tracking-wider font-medium mb-1">Email</p>
                <p className="text-sm text-text">{user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-text3 uppercase tracking-wider font-medium mb-1">Password</p>
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

          {/* North Star quick card */}
          {profile?.north_star && !editing && (
            <div className="north-star-card border border-border rounded-xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-burg/10 flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1l1.796 3.638L14 5.528l-3 2.924.708 4.131L8 10.5l-3.708 2.083L5 8.452 2 5.528l4.204-.89L8 1z" fill="var(--burg)" />
                  </svg>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-burg/70">North Star</p>
              </div>
              <p className="font-serif italic text-text text-sm leading-relaxed">{profile.north_star}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
