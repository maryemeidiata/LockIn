import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, buildDayStates, getDayIndex, getDayIndexFromTimestamp } from '../lib/weekUtils'
import Avatar from '../components/ui/Avatar'
import DayTrack from '../components/ui/DayTrack'
import CommitmentForm from '../components/CommitmentForm'
import CheckInButton from '../components/CheckInButton'
import LoadingPulse from '../components/ui/LoadingPulse'
import CardTag from '../components/ui/CardTag'

const MAX_MEMBERS = 6

export default function GroupDetail() {
  const { id: groupId } = useParams()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [myCommitment, setMyCommitment] = useState(null)
  const [todayChecked, setTodayChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [missExcuse, setMissExcuse] = useState('')
  const [showMissForm, setShowMissForm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [pendingInvites, setPendingInvites] = useState([])
  const [nudgeTarget, setNudgeTarget] = useState(null) // { id, name }
  const [nudgeMsg, setNudgeMsg] = useState('')
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeSent, setNudgeSent] = useState(false)

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
      .select('user_id, users(id, name, avatar_initials, north_star)')
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
        .select('commitment_id, user_id, day_of_week')
        .in('commitment_id', commitmentIds)
      checkins = data || []
    }

    let excuses = []
    if (commitmentIds.length) {
      const { data } = await supabase
        .from('missed_submissions')
        .select('user_id, submitted_at, status')
        .in('commitment_id', commitmentIds)
        .in('status', ['approved', 'rejected'])
      excuses = data || []
    }

    const memberList = (mems || []).map(m => {
      const u = m.users
      const commitment = commitments?.find(c => c.user_id === m.user_id)
      const userCheckins = checkins.filter(ci => ci.user_id === m.user_id)
      const checkinDays = userCheckins.map(ci => ci.day_of_week)
      const checked = userCheckins.some(ci => ci.day_of_week === dayIdx)
      const userExcuses = excuses.filter(e => e.user_id === m.user_id)
      const excusedDays = userExcuses.filter(e => e.status === 'approved').map(e => getDayIndexFromTimestamp(e.submitted_at))
      const rejectedDays = userExcuses.filter(e => e.status === 'rejected').map(e => getDayIndexFromTimestamp(e.submitted_at))
      return {
        ...u,
        commitment_text: commitment?.commitment_text || '',
        commitment_id: commitment?.id || null,
        dayStates: buildDayStates(checkinDays, weekStart, excusedDays, rejectedDays),
        todayChecked: checked,
      }
    })

    setMembers(memberList)
    const me = memberList.find(m => m.id === user.id)
    if (me?.todayChecked) setTodayChecked(true)
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
      .select('id, invited_email, created_at')
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
  }

  async function removeMember(memberId) {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', memberId)
    fetchMembers()
  }

  async function cancelInvite(inviteId) {
    await supabase.from('invitations').update({ status: 'cancelled' }).eq('id', inviteId)
    fetchPendingInvites()
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

  const isCreator = group?.created_by === user.id
  const totalSlots = members.length + pendingInvites.length
  const canInvite = totalSlots < MAX_MEMBERS

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-[26px] text-text tracking-tight">{group?.name}</h1>
          <CardTag label={`${members.length} members`} variant="group" />
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Invite
          </button>
        )}
      </div>

      {/* Commitment prompt when none set */}
      {!myCommitment && (
        <div className="bg-white border border-burg rounded-xl shadow-card p-5 mb-5">
          <p className="text-xs font-medium text-burg uppercase tracking-wider mb-3">Set this week's commitment</p>
          <CommitmentForm groupId={groupId} onSaved={fetchAll} />
        </div>
      )}

      {/* My commitment + check-in */}
      {myCommitment && (
        <div className="bg-white border border-border rounded-xl shadow-card p-5 mb-5">
          <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-1">Your commitment</p>
          <p className="text-sm text-text mb-1">{myCommitment.commitment_text}</p>
          <p className="text-xs text-text3 mb-4">If missed: {myCommitment.consequence_text}</p>
          <CheckInButton
            commitmentId={myCommitment.id}
            alreadyCheckedIn={todayChecked}
            onCheckIn={fetchMembers}
          />
          {!todayChecked && (
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
                  I missed today — submit an excuse
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white border border-border rounded-xl shadow-card p-5 mb-4">
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
                  {m.todayChecked && <span className="ml-2 text-[10px] text-burg font-medium">checked in</span>}
                </p>
                <p className="text-xs text-text3 truncate">{m.commitment_text || 'No commitment set'}</p>
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
              {isCreator && m.id !== user.id && (
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
                <p className="text-sm text-text3">{inv.invited_email}</p>
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

      {!canInvite && (
        <p className="text-xs text-text3 text-center mt-4">
          Group is full ({MAX_MEMBERS} people max including pending invites).
        </p>
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
                  placeholder={`You've got this — don't give up!`}
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
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: email.trim(),
          group_id: groupId,
          group_name: groupName,
          inviter_name: profile?.name || 'A friend',
        }),
      }
    )

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || 'Failed to send invite')
      return
    }

    if (json.addedDirectly) {
      setSuccess(true)
      setError(`${email} already has an account and has been added to the group.`)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-text mb-1">Invite someone</h2>
        <p className="text-xs text-text3 mb-5">They'll get an email to join {groupName}.</p>

        {success ? (
          <div className="space-y-4">
            <div className="bg-cream2 rounded-xl p-4 text-sm text-text">
              {error || `Invite sent to ${email}!`}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setSuccess(false); setEmail(''); setError('') }} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border">
                Invite another
              </button>
              <button onClick={onInvited} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="friend@example.com"
                autoFocus
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg placeholder-text3"
              />
            </div>
            {error && <p className="text-xs text-burg">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50">
                {loading ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

