import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, buildDayStates, getDayIndex, getDayIndexFromTimestamp } from '../lib/weekUtils'
import Avatar from '../components/ui/Avatar'
import DayTrack from '../components/ui/DayTrack'
import CommitmentForm from '../components/CommitmentForm'
import CheckInButton from '../components/CheckInButton'
import LoadingPulse from '../components/ui/LoadingPulse'
import CardTag from '../components/ui/CardTag'
import { clearCache } from '../lib/cache'


export default function GroupDetail() {
  const { id: groupId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [myCommitment, setMyCommitment] = useState(null)
  const [todayChecked, setTodayChecked] = useState(false)
  const [todayExcused, setTodayExcused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [missExcuse, setMissExcuse] = useState('')
  const [showMissForm, setShowMissForm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [pendingInvites, setPendingInvites] = useState([])
  const [nudgeTarget, setNudgeTarget] = useState(null) // { id, name }
  const [nudgeMsg, setNudgeMsg] = useState('')
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeSent, setNudgeSent] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)

  const weekStart = getCurrentWeekStartStr()
  const dayIdx = getDayIndex()

  useEffect(() => {
    if (user && groupId) fetchAll()
  }, [user, groupId])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchGroup(), fetchMembers(), fetchMyCommitment(), fetchPendingInvites()])
    setLoading(false)
  }

  async function fetchGroup() {
    const { data } = await supabase.from('groups').select('*').eq('id', groupId).single()
    setGroup(data)
  }

  async function fetchMembers() {
    const { data: mems } = await supabase
      .from('group_members')
      .select('user_id, role, users(id, name, avatar_initials, north_star)')
      .eq('group_id', groupId)

    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, user_id, commitment_text, consequence_text')
      .eq('group_id', groupId)
      .eq('week_start', weekStart)

    const commitmentIds = (commitments || []).map(c => c.id)
    let checkins = []
    if (commitmentIds.length) {
      const { data } = await supabase
        .from('checkins')
        .select('commitment_id, user_id, day_of_week, photo_url')
        .in('commitment_id', commitmentIds)
      checkins = data || []
    }

    let excuses = []
    if (commitmentIds.length) {
      const { data } = await supabase
        .from('missed_submissions')
        .select('user_id, submitted_at, status')
        .in('commitment_id', commitmentIds)
        .in('status', ['approved', 'rejected', 'pending'])
      excuses = data || []
    }

    const memberList = (mems || []).map(m => {
      const u = m.users
      const commitment = commitments?.find(c => c.user_id === m.user_id)
      const role = m.role || 'member'
      const userCheckins = checkins.filter(ci => ci.user_id === m.user_id)
      const checkinDays = userCheckins.map(ci => ci.day_of_week)
      const checked = userCheckins.some(ci => ci.day_of_week === dayIdx)
      const todayPhoto = userCheckins.find(ci => ci.day_of_week === dayIdx)?.photo_url || null
      const userExcuses = excuses.filter(e => e.user_id === m.user_id)
      const excusedDays = userExcuses.filter(e => e.status === 'approved').map(e => getDayIndexFromTimestamp(e.submitted_at))
      const rejectedDays = userExcuses.filter(e => e.status === 'rejected').map(e => getDayIndexFromTimestamp(e.submitted_at))
      return {
        ...u,
        role,
        commitment_text: commitment?.commitment_text || '',
        commitment_id: commitment?.id || null,
        dayStates: buildDayStates(checkinDays, weekStart, excusedDays, rejectedDays),
        todayChecked: checked,
        todayPhoto,
      }
    })

    setMembers(memberList)
    const me = memberList.find(m => m.id === user.id)
    if (me?.todayChecked) setTodayChecked(true)
    const myCommitmentId = commitments?.find(c => c.user_id === user.id)?.id
    if (myCommitmentId) {
      const todayExcuse = excuses.find(e => e.user_id === user.id && getDayIndexFromTimestamp(e.submitted_at) === dayIdx)
      if (todayExcuse) setTodayExcused(true)
    }
  }

  async function fetchMyCommitment() {
    const { data } = await supabase
      .from('commitments')
      .select('*')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .eq('week_start', weekStart)
      .single()
    setMyCommitment(data || null)
  }

  async function fetchPendingInvites() {
    const { data } = await supabase
      .from('invitations')
      .select('id, invited_email, invited_user_id, created_at, users!invitations_invited_user_id_fkey(name)')
      .eq('group_id', groupId)
      .eq('status', 'pending')
    setPendingInvites(data || [])
  }

  async function submitMissedExcuse() {
    if (!myCommitment || !missExcuse.trim()) return
    await supabase.from('missed_submissions').insert({
      commitment_id: myCommitment.id,
      user_id: user.id,
      excuse_text: missExcuse.trim(),
    })
    setShowMissForm(false)
    setMissExcuse('')
    setTodayExcused(true)
  }

  async function removeMember(memberId) {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', memberId)
    fetchMembers()
  }

  async function promoteToAdmin(memberId) {
    await supabase.from('group_members').update({ role: 'admin' }).eq('group_id', groupId).eq('user_id', memberId)
    fetchMembers()
  }

  async function cancelInvite(inviteId) {
    await supabase.from('invitations').update({ status: 'cancelled' }).eq('id', inviteId)
    fetchPendingInvites()
  }

  async function copyInviteLink() {
    const { data: existing, error: fetchError } = await supabase
      .from('invite_links')
      .select('token')
      .eq('group_id', groupId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('invite_links fetch error:', fetchError)
      alert('Could not generate invite link. Make sure the invite_links table exists in Supabase.')
      return
    }

    let token = existing?.token
    if (!token) {
      token = crypto.randomUUID()
      const { error: insertError } = await supabase
        .from('invite_links')
        .insert({ token, group_id: groupId, created_by: user.id })
      if (insertError) {
        console.error('invite_links insert error:', insertError)
        alert('Could not generate invite link: ' + insertError.message)
        return
      }
    }

    const url = `${window.location.origin}/join/${token}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // fallback for browsers that block clipboard API
      prompt('Copy this invite link:', url)
      return
    }
    setInviteLinkCopied(true)
    setTimeout(() => setInviteLinkCopied(false), 2000)
  }

  async function leaveGroup() {
    setLeaving(true)
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
    clearCache('groups')
    clearCache('overview')
    navigate('/groups')
  }

  async function sendNudge() {
    if (!nudgeTarget) return
    setNudgeSending(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nudge-friend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ to_user_id: nudgeTarget.id, message: nudgeMsg.trim() || undefined }),
    })
    setNudgeSending(false)
    setNudgeSent(true)
    setTimeout(() => {
      setNudgeTarget(null)
      setNudgeMsg('')
      setNudgeSent(false)
    }, 2000)
  }

  if (loading) return <LoadingPulse lines={5} />

  const isAdmin = members.find(m => m.id === user.id)?.role === 'admin'
  const isMember = members.some(m => m.id === user.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {group?.avatar_url && (
            <img src={group.avatar_url} alt={group.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-border shadow-card" onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
          <h1 className="font-serif text-[26px] text-text tracking-tight">{group?.name}</h1>
          <CardTag label={`${members.length} members`} variant="group" />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full border border-border hover:border-burg hover:text-burg transition-colors text-text3"
              title="Group settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="px-3 py-2 text-xs font-medium text-text3 border border-border rounded-[10px] hover:border-burg hover:text-burg transition-colors"
          >
            Leave
          </button>
          {isMember && (
            <button
              onClick={copyInviteLink}
              className="px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
            >
              {inviteLinkCopied ? 'Copied!' : 'Invite'}
            </button>
          )}
        </div>
      </div>

      {/* Commitment prompt when none set */}
      {!myCommitment && (
        <div className="bg-white border border-burg rounded-2xl shadow-card p-5 mb-5">
          <p className="text-xs font-medium text-burg uppercase tracking-wider mb-3">Set this week's commitment</p>
          <CommitmentForm groupId={groupId} onSaved={fetchAll} />
        </div>
      )}

      {/* My commitment + check-in */}
      {myCommitment && (
        <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
          <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">Your commitment</p>
          <p className="text-sm text-text mb-1">{myCommitment.commitment_text}</p>
          <p className="text-xs text-text3 mb-4">If missed: {myCommitment.consequence_text}</p>
          <CheckInButton
            commitmentId={myCommitment.id}
            alreadyCheckedIn={todayChecked}
            onCheckIn={fetchMembers}
          />
          {!todayChecked && todayExcused && (
            <p className="text-xs text-text3 text-center mt-3">Excuse submitted — pending review.</p>
          )}
          {!todayChecked && !todayExcused && (
            <div className="mt-3">
              {showMissForm ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={missExcuse}
                    onChange={e => setMissExcuse(e.target.value)}
                    rows={2}
                    placeholder="Explain what happened..."
                    className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-burg resize-none placeholder-text3"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowMissForm(false)} className="flex-1 py-2 text-xs font-medium text-text2 bg-cream2 rounded-[10px] border border-border">
                      Cancel
                    </button>
                    <button onClick={submitMissedExcuse} className="flex-1 py-2 text-xs font-medium text-cream bg-burg rounded-[10px] hover:bg-burg-light transition-colors">
                      Submit excuse
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowMissForm(true)} className="text-xs text-text3 hover:text-text2 underline w-full text-center mt-1">
                  I missed today, submit an excuse
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-text2 uppercase tracking-wider">Group progress this week</p>
          <DayTrack states={[]} showLabels />
        </div>
        <div className="space-y-0.5">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-cream2 last:border-0 group">
              <Avatar userId={m.id} initials={m.avatar_initials} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">
                  {m.id === user.id ? 'You' : m.name}
                  {m.role === 'admin' && <span className="ml-2 text-[9px] text-burg font-medium uppercase tracking-wider">admin</span>}
                  {m.todayChecked && <span className="ml-2 text-[10px] text-burg font-medium">checked in</span>}
                </p>
                <p className="text-xs text-text3 truncate">{m.commitment_text || 'No commitment set'}</p>
                {m.todayPhoto && (
                  <a href={m.todayPhoto} target="_blank" rel="noopener noreferrer">
                    <img
                      src={m.todayPhoto}
                      alt="Check-in proof"
                      className="mt-1.5 h-16 w-24 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity"
                      onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
                    />
                  </a>
                )}
              </div>
              <DayTrack states={m.dayStates} />
              {m.id !== user.id && (
                <button
                  onClick={() => { setNudgeTarget({ id: m.id, name: m.name?.split(' ')[0] || m.name }); setNudgeMsg('') }}
                  className="ml-1 text-[11px] text-text3 hover:text-burg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                  title="Send a nudge"
                >
                  Nudge
                </button>
              )}
              {isAdmin && m.id !== user.id && m.role !== 'admin' && (
                <button
                  onClick={() => promoteToAdmin(m.id)}
                  className="text-[11px] text-text3 hover:text-burg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                  title="Make admin"
                >
                  Make admin
                </button>
              )}
              {isAdmin && m.id !== user.id && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-[11px] text-text3 hover:text-burg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from group"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="bg-white border border-border rounded-xl shadow-card p-5">
          <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-3">Pending invitations</p>
          <div className="space-y-2">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-1.5">
                <p className="text-sm text-text3">
                  {inv.users?.name || inv.invited_email || 'Invited user'}
                  <span className="ml-2 text-[10px] text-text3 italic">pending</span>
                </p>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  className="text-xs text-text3 hover:text-burg underline"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}


      {showInviteModal && (
        <InviteModal
          groupId={groupId}
          groupName={group?.name}
          userId={user.id}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { setShowInviteModal(false); fetchPendingInvites() }}
          existingCount={totalSlots}
        />
      )}

      {showSettings && (
        <GroupSettingsModal
          group={group}
          onClose={() => setShowSettings(false)}
          onSaved={updates => { setGroup(g => ({ ...g, ...updates })); setShowSettings(false) }}
          onDeleted={() => { clearCache('groups'); clearCache('overview'); navigate('/groups') }}
        />
      )}

      {/* Leave group confirm */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={() => setShowLeaveConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-xl text-text mb-2">Leave {group?.name}?</h2>
            <p className="text-sm text-text3 mb-5">Your commitments and check-in history will remain, but you'll no longer be part of this group.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors"
              >
                Stay
              </button>
              <button
                onClick={leaveGroup}
                disabled={leaving}
                className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
              >
                {leaving ? 'Leaving...' : 'Leave group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nudge modal */}
      {nudgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(26,10,16,0.4)' }} onClick={() => setNudgeTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            {nudgeSent ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-2">💪</p>
                <p className="font-serif text-lg text-text">Nudge sent!</p>
                <p className="text-sm text-text3 mt-1">{nudgeTarget.name} got your message.</p>
              </div>
            ) : (
              <>
                <p className="font-serif text-[18px] text-text mb-1">Nudge {nudgeTarget.name}</p>
                <p className="text-xs text-text3 mb-4">Send a personal push notification to their phone.</p>
                <textarea
                  value={nudgeMsg}
                  onChange={e => setNudgeMsg(e.target.value)}
                  placeholder={`You've got this, don't give up!`}
                  rows={3}
                  maxLength={120}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg resize-none placeholder-text3 mb-4"
                />
                <div className="flex gap-2">
                  <button onClick={() => setNudgeTarget(null)} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors">
                    Cancel
                  </button>
                  <button onClick={sendNudge} disabled={nudgeSending} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50">
                    {nudgeSending ? 'Sending…' : 'Send nudge 💪'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InviteModal({ groupId, groupName, userId, onClose, onInvited, existingCount }) {
  const { profile } = useAuth()
  const [tab, setTab] = useState('search')
  // Search tab
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [feedback, setFeedback] = useState({}) // { [id]: 'invited' | 'member' | 'pending' }
  const [invitedCount, setInvitedCount] = useState(0)
  // Email tab
  const [email, setEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState(false)

  async function searchUsers(query) {
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    const q = query.trim().replace(/^@/, '')
    // Search by name first (always works), then try username too
    const { data: byName } = await supabase
      .from('users')
      .select('id, name, username, avatar_initials, avatar_url')
      .ilike('name', `%${q}%`)
      .neq('id', userId)
      .limit(10)
    const { data: byUsername } = await supabase
      .from('users')
      .select('id, name, username, avatar_initials, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', userId)
      .limit(10)
    // Merge and deduplicate by id
    const merged = [...(byName || []), ...(byUsername || [])]
    const seen = new Set()
    const unique = merged.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true })
    setResults(unique.slice(0, 10))
    setSearching(false)
  }

  async function inviteUser(person) {
    const { data: existing } = await supabase.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', person.id).maybeSingle()
    if (existing) { setFeedback(f => ({ ...f, [person.id]: 'member' })); return }
    const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: person.id, role: 'member' })
    if (!error) { setFeedback(f => ({ ...f, [person.id]: 'added' })); setInvitedCount(n => n + 1) }
  }

  async function handleEmailInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setEmailLoading(true)
    setEmailError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: email.trim(), group_id: groupId, group_name: groupName, inviter_name: profile?.name || 'A friend' }),
    })
    const json = await res.json()
    setEmailLoading(false)
    if (!res.ok) { setEmailError(json.error || 'Failed to send invite'); return }
    setEmailSuccess(true)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header + tabs */}
        <div className="px-6 pt-5 pb-0 border-b border-cream2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-xl text-text">Invite to {groupName}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream2 text-text3 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex gap-5">
            {[['search', 'Search by name'], ['email', 'Invite by email']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`text-sm pb-3 border-b-2 transition-colors ${tab === id ? 'border-burg text-burg font-medium' : 'border-transparent text-text3 hover:text-text2'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {tab === 'search' && (
            <div>
              <div className="flex items-center gap-2 bg-cream2 rounded-2xl px-4 py-2.5 mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text3 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  autoFocus
                  value={search}
                  onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
                  placeholder="Name or @username…"
                  className="flex-1 text-sm text-text bg-transparent focus:outline-none placeholder-text3"
                />
              </div>

              {results.length > 0 ? (
                <div className="space-y-0.5 max-h-60 overflow-y-auto mb-4">
                  {results.map(person => {
                    const fb = feedback[person.id]
                    return (
                      <div key={person.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-cream2/60 transition-colors">
                        <Avatar userId={person.id} initials={person.avatar_initials} avatarUrl={person.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">{person.name}</p>
                          {person.username
                            ? <p className="text-[11px] text-text3">@{person.username}</p>
                            : fb === 'member' ? <p className="text-[11px] text-text3 italic">Already a member</p>
                            : fb === 'pending' ? <p className="text-[11px] text-text3 italic">Already invited</p>
                            : null}
                          {person.username && fb === 'member' && <p className="text-[11px] text-text3 italic">Already a member</p>}
                          {person.username && fb === 'pending' && <p className="text-[11px] text-text3 italic">Already invited</p>}
                        </div>
                        {!fb && (
                          <button onClick={() => inviteUser(person)} className="text-[11px] font-medium text-burg border border-burg rounded-lg px-2.5 py-1 hover:bg-burg hover:text-cream transition-colors flex-shrink-0">
                            Invite
                          </button>
                        )}
                        {fb === 'added' && <span className="text-[11px] font-semibold text-burg flex-shrink-0">Added ✓</span>}
                      </div>
                    )
                  })}
                </div>
              ) : search && !searching ? (
                <p className="text-sm text-text3 text-center py-6 italic">No one found — try the email tab to invite them.</p>
              ) : !search ? (
                <p className="text-xs text-text3 text-center py-4">Search for people already on LockIn.</p>
              ) : null}

              {invitedCount > 0 && (
                <button onClick={onInvited} className="w-full py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors">
                  Done · {invitedCount} added
                </button>
              )}
            </div>
          )}

          {tab === 'email' && (
            <div>
              <p className="text-xs text-text3 mb-4">For people not on LockIn yet. They'll get an email to join {groupName}.</p>
              {emailSuccess ? (
                <div className="space-y-4">
                  <div className="bg-cream2 rounded-xl p-4 text-sm text-text">Invite sent to {email}!</div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEmailSuccess(false); setEmail('') }} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border">
                      Invite another
                    </button>
                    <button onClick={onInvited} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px]">
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailInvite} className="space-y-4">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@example.com" autoFocus={tab === 'email'}
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg placeholder-text3" />
                  {emailError && <p className="text-xs text-burg">{emailError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border">Cancel</button>
                    <button type="submit" disabled={emailLoading} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] disabled:opacity-50">
                      {emailLoading ? 'Sending...' : 'Send invite'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GroupSettingsModal({ group, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(group?.name || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(group?.avatar_url || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('invitations').delete().eq('group_id', group.id)
    await supabase.from('group_members').delete().eq('group_id', group.id)
    await supabase.from('groups').delete().eq('id', group.id)
    setDeleting(false)
    onDeleted()
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Group name is required.'); return }
    setLoading(true)
    setError('')

    let avatar_url = group?.avatar_url || null

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `${group.id}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('group-avatars').upload(path, avatarFile, { contentType: avatarFile.type, upsert: true })
      if (uploadErr) { setError('Photo upload failed: ' + uploadErr.message); setLoading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('group-avatars').getPublicUrl(path)
      avatar_url = publicUrl + `?t=${Date.now()}`
    }

    const updates = { name: name.trim() }
    if (avatar_url !== group?.avatar_url) updates.avatar_url = avatar_url

    const { error: updateErr } = await supabase.from('groups').update(updates).eq('id', group.id)
    setLoading(false)
    if (updateErr) { setError(updateErr.message); return }
    onSaved({ ...updates })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-text mb-5">Group settings</h2>

        {/* Group photo */}
        <div className="flex flex-col items-center mb-5">
          <button onClick={() => fileRef.current?.click()} className="relative group mb-2">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-cream2 flex items-center justify-center border border-border">
              {avatarPreview
                ? <img src={avatarPreview} alt="Group" className="w-full h-full object-cover" />
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
              }
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
          </button>
          <p className="text-[11px] text-text3">Tap to change group photo</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Name */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Group name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg"
          />
        </div>

        {error && <p className="text-xs text-burg mb-3">{error}</p>}

        <div className="flex gap-2 mb-5">
          <button onClick={onClose} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50">
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        {/* Danger zone */}
        <div className="border-t border-border pt-4">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-[10px] hover:bg-red-50 transition-colors"
            >
              Delete group
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-medium text-red-700 mb-1">Delete "{group?.name}"?</p>
              <p className="text-xs text-red-500 mb-4">This removes all members, invitations, and the group permanently. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 text-xs font-medium text-text2 bg-white border border-border rounded-[10px]">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 text-xs font-medium text-white bg-red-600 rounded-[10px] hover:bg-red-700 transition-colors disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
