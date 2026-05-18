import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, buildDayStates, getDayIndexFromTimestamp } from '../lib/weekUtils'
import Avatar from '../components/ui/Avatar'
import DayTrack from '../components/ui/DayTrack'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function Friends() {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [nudgeTarget, setNudgeTarget] = useState(null)
  const [nudgeMsg, setNudgeMsg] = useState('')
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeSent, setNudgeSent] = useState(false)

  useEffect(() => {
    if (user) fetchFriends()
  }, [user])

  async function fetchFriends() {
    setLoading(true)
    const weekStart = getCurrentWeekStartStr()

    // Get all groups the user belongs to
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id)

    if (!memberships?.length) { setLoading(false); return }

    const groupIds = memberships.map(m => m.group_id)

    // Get all members across those groups (excluding self)
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('user_id, group_id, users(id, name, avatar_url, avatar_initials, north_star)')
      .in('group_id', groupIds)
      .neq('user_id', user.id)

    if (!allMembers?.length) { setLoading(false); return }

    // Deduplicate by user_id, but keep track of shared groups
    const friendMap = {}
    for (const m of allMembers) {
      const u = m.users
      if (!u) continue
      const group = memberships.find(g => g.group_id === m.group_id)?.groups
      if (!friendMap[u.id]) {
        friendMap[u.id] = { ...u, groups: [], dayStates: Array(7).fill('empty'), commitment_text: '' }
      }
      if (group) friendMap[u.id].groups.push(group.name)
    }

    // Get commitments + checkins for this week for each friend
    const friendIds = Object.keys(friendMap)
    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, user_id, commitment_text, group_id')
      .in('user_id', friendIds)
      .in('group_id', groupIds)
      .eq('week_start', weekStart)

    const commitmentIds = commitments?.map(c => c.id) || []
    let checkins = []
    let excuses = []

    if (commitmentIds.length) {
      const { data: ci } = await supabase
        .from('checkins')
        .select('commitment_id, user_id, day_of_week')
        .in('commitment_id', commitmentIds)
      checkins = ci || []

      const { data: ex } = await supabase
        .from('missed_submissions')
        .select('user_id, submitted_at, status')
        .in('commitment_id', commitmentIds)
        .in('status', ['approved', 'rejected'])
      excuses = ex || []
    }

    // Attach commitment + day states to each friend
    for (const fid of friendIds) {
      const commitment = commitments?.find(c => c.user_id === fid)
      if (commitment) {
        friendMap[fid].commitment_text = commitment.commitment_text
        const userCheckins = checkins.filter(ci => ci.user_id === fid).map(ci => ci.day_of_week)
        const approved = excuses.filter(e => e.user_id === fid && e.status === 'approved').map(e => getDayIndexFromTimestamp(e.submitted_at))
        const rejected = excuses.filter(e => e.user_id === fid && e.status === 'rejected').map(e => getDayIndexFromTimestamp(e.submitted_at))
        friendMap[fid].dayStates = buildDayStates(userCheckins, weekStart, approved, rejected)
      }
    }

    setFriends(Object.values(friendMap))
    setLoading(false)
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

  if (loading) return <LoadingPulse lines={4} />

  return (
    <div>
      <h1 className="font-serif text-[26px] text-text tracking-tight mb-6">Friends</h1>

      {friends.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream2 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text3">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">No friends yet</p>
          <p className="text-xs text-text3">Join or create a group to connect with people.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map(friend => (
            <div key={friend.id} className="bg-white border border-border rounded-xl shadow-card px-4 py-3.5 flex items-center gap-3">
              <Avatar userId={friend.id} avatarUrl={friend.avatar_url} initials={friend.avatar_initials} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{friend.name}</p>
                <p className="text-xs text-text3 truncate">
                  {friend.commitment_text || <span className="italic">No commitment this week</span>}
                </p>
                <p className="text-[10px] text-text3 mt-0.5 truncate">{friend.groups.join(', ')}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <DayTrack states={friend.dayStates} />
                <button
                  onClick={() => { setNudgeTarget({ id: friend.id, name: friend.name?.split(' ')[0] }); setNudgeMsg('') }}
                  className="text-[11px] font-medium text-burg hover:underline transition-colors"
                >
                  Nudge 💪
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nudge modal */}
      {nudgeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(26,10,16,0.4)' }}
          onClick={() => setNudgeTarget(null)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            {nudgeSent ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">💪</p>
                <p className="font-serif text-lg text-text">Nudge sent!</p>
                <p className="text-sm text-text3 mt-1">{nudgeTarget.name} got your message.</p>
              </div>
            ) : (
              <>
                <p className="font-serif text-[18px] text-text mb-1">Nudge {nudgeTarget.name}</p>
                <p className="text-xs text-text3 mb-4">Send a push notification straight to their phone.</p>
                <textarea
                  value={nudgeMsg}
                  onChange={e => setNudgeMsg(e.target.value)}
                  placeholder="You've got this — don't give up!"
                  rows={3}
                  maxLength={120}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg resize-none placeholder-text3 mb-1"
                />
                <p className="text-[10px] text-text3 text-right mb-4">{nudgeMsg.length}/120</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNudgeTarget(null)}
                    className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendNudge}
                    disabled={nudgeSending}
                    className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
                  >
                    {nudgeSending ? 'Sending…' : 'Send 💪'}
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
