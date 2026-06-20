import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, buildDayStates, getDayIndexFromTimestamp } from '../lib/weekUtils'
import { getCache, setCache, clearCache } from '../lib/cache'
import CardTag from '../components/ui/CardTag'
import Avatar from '../components/ui/Avatar'
import DayTrack from '../components/ui/DayTrack'
import LoadingPulse from '../components/ui/LoadingPulse'

const MAX_GROUPS = 20

export default function Groups() {
  const { user } = useAuth()
  const cached = getCache('groups')
  const [groups, setGroups] = useState(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [showModal, setShowModal] = useState(false)
  const [pendingInvites, setPendingInvites] = useState([])

  useEffect(() => {
    if (user) {
      fetchGroups()
      fetchPendingInvites()
    }
  }, [user])

  async function fetchGroups() {
    if (!getCache('groups')) setLoading(true)
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, created_at, avatar_url)')
      .eq('user_id', user.id)

    if (!memberships?.length) { setLoading(false); return }

    const weekStart = getCurrentWeekStartStr()
    const enriched = await Promise.all(
      memberships.map(async ({ groups: group }) => {
        if (!group) return null
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id, users(id, name, avatar_initials, avatar_url)')
          .eq('group_id', group.id)

        const { data: commitments } = await supabase
          .from('commitments')
          .select('id, user_id, commitment_text, status')
          .eq('group_id', group.id)
          .eq('week_start', weekStart)

        const { data: checkins } = await supabase
          .from('checkins')
          .select('commitment_id, user_id, day_of_week')
          .in('commitment_id', (commitments || []).map(c => c.id))

        const { data: excuses } = await supabase
          .from('missed_submissions')
          .select('user_id, submitted_at, status')
          .in('commitment_id', (commitments || []).map(c => c.id))
          .in('status', ['approved', 'rejected'])

        const memberList = (members || []).map(m => {
          const commitment = commitments?.find(c => c.user_id === m.user_id)
          const checkinDays = (checkins || [])
            .filter(ci => ci.user_id === m.user_id)
            .map(ci => ci.day_of_week)
          const userExcuses = (excuses || []).filter(e => e.user_id === m.user_id)
          const excusedDays = userExcuses.filter(e => e.status === 'approved').map(e => getDayIndexFromTimestamp(e.submitted_at))
          const rejectedDays = userExcuses.filter(e => e.status === 'rejected').map(e => getDayIndexFromTimestamp(e.submitted_at))
          return {
            ...m.users,
            commitment_text: commitment?.commitment_text || '',
            dayStates: buildDayStates(checkinDays, weekStart, excusedDays, rejectedDays),
          }
        })

        const done = commitments?.filter(c => c.status === 'completed').length || 0
        return { ...group, members: memberList, weekProgress: { done, total: members?.length || 0 } }
      })
    )

    const filtered = enriched.filter(Boolean)
    setGroups(filtered)
    setCache('groups', filtered)
    setLoading(false)
  }

  async function fetchPendingInvites() {
    const { data } = await supabase
      .from('invitations')
      .select('id, group_id, groups(name), invited_by, users!invitations_invited_by_fkey(name)')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending')
    setPendingInvites(data || [])
  }

  async function respondToInvite(inviteId, groupId, accept) {
    if (accept) {
      await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id })
    }
    await supabase.from('invitations').update({ status: accept ? 'accepted' : 'declined' }).eq('id', inviteId)
    fetchPendingInvites()
    if (accept) { clearCache('groups'); clearCache('overview'); fetchGroups() }
  }

  if (loading) return <div className="space-y-4"><LoadingPulse lines={3} /></div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(107,30,58,0.08)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--burg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-[22px] text-text tracking-tight leading-none mb-0.5">My groups</h1>
          <p className="text-xs text-text3">{groups.length > 0 ? `${groups.length} group${groups.length !== 1 ? 's' : ''}` : 'Create or join a group'}</p>
        </div>
        <button
          onClick={() => {
            if (groups.length >= MAX_GROUPS) return
            setShowModal(true)
          }}
          disabled={groups.length >= MAX_GROUPS}
          className="px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50 flex-shrink-0"
        >
          Create group
        </button>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="space-y-3 mb-5">
          {pendingInvites.map(inv => (
            <div key={inv.id} className="bg-white border border-burg/30 rounded-2xl shadow-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-burg uppercase tracking-wider mb-0.5">Group invitation</p>
                  <p className="text-sm font-medium text-text">{inv.groups?.name}</p>
                  <p className="text-xs text-text3 mt-0.5">
                    Invited by {inv.users?.name || 'someone'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => respondToInvite(inv.id, inv.group_id, false)}
                    className="px-3 py-1.5 text-xs font-medium text-text2 bg-cream2 border border-border rounded-[8px] hover:bg-cream3 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => respondToInvite(inv.id, inv.group_id, true)}
                    className="px-3 py-1.5 text-xs font-medium text-cream bg-burg rounded-[8px] hover:bg-burg-light transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {groups.length >= MAX_GROUPS && (
        <div className="bg-cream2 border border-border rounded-2xl p-4 mb-5 text-sm text-text2">
          You are in {MAX_GROUPS} groups, which is the maximum. Groups are intentionally limited to keep accountability meaningful and your attention focused.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream2 flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--burg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">No groups yet</p>
          <p className="text-text3 text-xs mb-5 max-w-xs mx-auto">Create a group and invite the people who actually hold you accountable.</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Create your first group
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <GroupDetailCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateGroupModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); clearCache('groups'); clearCache('overview'); fetchGroups() }}
          userId={user.id}
        />
      )}
    </div>
  )
}

function GroupDetailCard({ group }) {
  const checkedIn = group.members?.filter(m => m.dayStates?.some(s => s === 'done')).length || 0
  const total = group.members?.length || 0
  const progressPct = total ? Math.round((checkedIn / total) * 100) : 0

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden card-interactive">
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 border-b border-cream2">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {group.avatar_url
              ? <img src={group.avatar_url} alt={group.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-border" onError={e => { e.currentTarget.style.display = 'none' }} />
              : <div className="w-10 h-10 rounded-xl bg-cream2 border border-border flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
            }
            <div>
              <p className="font-medium text-text">{group.name}</p>
              <p className="text-[11px] text-text3 mt-0.5">{total} members · {checkedIn} checked in today</p>
            </div>
          </div>
          <Link
            to={`/groups/${group.id}`}
            className="text-xs font-medium text-burg hover:underline flex-shrink-0 mt-0.5"
          >
            View →
          </Link>
        </div>

        {/* Overlapping avatars + progress */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {group.members?.slice(0, 6).map(m => (
              <div key={m.id} className="ring-2 ring-white rounded-full">
                <Avatar userId={m.id} initials={m.avatar_initials} avatarUrl={m.avatar_url} size="sm" />
              </div>
            ))}
          </div>
          <div className="text-right">
            <p className="text-[11px] text-text3">{checkedIn}/{total} checked in</p>
            <div className="w-24 h-1.5 bg-cream2 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-burg rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Member rows */}
      <div className="px-5 divide-y divide-cream2">
        {group.members?.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-3">
            <Avatar userId={m.id} initials={m.avatar_initials} avatarUrl={m.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">{m.name}</p>
              <p className="text-[11px] text-text3 truncate">{m.commitment_text || 'No commitment set'}</p>
            </div>
            <DayTrack states={m.dayStates || []} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateGroupModal({ onClose, onCreated, userId }) {
  const [name, setName] = useState(() => sessionStorage.getItem('cg_name') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [friends, setFriends] = useState([])
  const [selected, setSelected] = useState(new Set())

  useEffect(() => {
    async function loadFriends() {
      // Load from friendships table
      const { data: friendshipData } = await supabase
        .from('friendships')
        .select('friend_id, users!friendships_friend_id_fkey(id, name, avatar_initials, avatar_url)')
        .eq('user_id', userId)
      const friendshipUsers = (friendshipData || []).map(f => f.users).filter(Boolean)

      // Also load everyone the user has been in a group with
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
      const groupIds = (myGroups || []).map(g => g.group_id)

      let groupUsers = []
      if (groupIds.length > 0) {
        const { data: groupMembersData } = await supabase
          .from('group_members')
          .select('user_id, users(id, name, avatar_initials, avatar_url)')
          .in('group_id', groupIds)
          .neq('user_id', userId)
        groupUsers = (groupMembersData || []).map(m => m.users).filter(Boolean)
      }

      // Merge, deduplicate by id
      const seen = new Set()
      const merged = [...friendshipUsers, ...groupUsers].filter(u => {
        if (!u || seen.has(u.id)) return false
        seen.add(u.id)
        return true
      })
      setFriends(merged)
    }
    loadFriends()
  }, [userId])

  function handleNameChange(val) {
    setName(val)
    sessionStorage.setItem('cg_name', val)
  }

  function toggleFriend(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Group name is required.'); return }
    setLoading(true)

    const { data: group, error: gErr } = await supabase
      .from('groups')
      .insert({ name: name.trim(), created_by: userId })
      .select()
      .single()

    if (gErr) { setError(gErr.message); setLoading(false); return }

    // Add creator as admin
    await supabase.from('group_members').insert({ group_id: group.id, user_id: userId, role: 'admin' })

    // Add selected friends directly as members
    for (const friendId of selected) {
      await supabase.from('group_members').insert({ group_id: group.id, user_id: friendId, role: 'member' })
    }

    sessionStorage.removeItem('cg_name')
    setLoading(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-text mb-1">Create a group</h2>
        <p className="text-xs text-text3 mb-5">Groups are limited to 6 people to keep accountability personal.</p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Group name</label>
            <input
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="MSc crew, Gym squad..."
              className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text focus:outline-none focus:border-burg placeholder-text3"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-2">
              Invite friends {selected.size > 0 && <span className="text-burg">({selected.size} selected)</span>}
            </label>
            {friends.length === 0 ? (
              <p className="text-xs text-text3 italic">No contacts yet. Add friends from the Friends tab first.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {friends.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFriend(f.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors text-left ${
                      selected.has(f.id)
                        ? 'border-burg bg-cream2'
                        : 'border-border hover:bg-cream2'
                    }`}
                  >
                    <Avatar userId={f.id} initials={f.avatar_initials} avatarUrl={f.avatar_url} size="sm" />
                    <p className="text-sm text-text flex-1">{f.name}</p>
                    {selected.has(f.id) && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-burg flex-shrink-0">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-burg">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] hover:bg-cream3 transition-colors border border-border">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50">
              {loading ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
