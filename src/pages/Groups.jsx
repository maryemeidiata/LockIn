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

const MAX_GROUPS = 3

export default function Groups() {
  const { user } = useAuth()
  const cached = getCache('groups')
  const [groups, setGroups] = useState(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (user) fetchGroups()
  }, [user])

  async function fetchGroups() {
    if (!getCache('groups')) setLoading(true)
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, created_at)')
      .eq('user_id', user.id)

    if (!memberships?.length) { setLoading(false); return }

    const weekStart = getCurrentWeekStartStr()
    const enriched = await Promise.all(
      memberships.map(async ({ groups: group }) => {
        if (!group) return null
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id, users(id, name, avatar_initials)')
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

  if (loading) return <div className="space-y-4"><LoadingPulse lines={3} /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-[26px] text-text tracking-tight">My groups</h1>
        <button
          onClick={() => {
            if (groups.length >= MAX_GROUPS) return
            setShowModal(true)
          }}
          disabled={groups.length >= MAX_GROUPS}
          className="px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
        >
          Create group
        </button>
      </div>

      {groups.length >= MAX_GROUPS && (
        <div className="bg-cream2 border border-border rounded-xl p-4 mb-5 text-sm text-text2">
          You are in {MAX_GROUPS} groups, which is the maximum. Groups are intentionally limited to keep accountability meaningful and your attention focused.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-10 text-center">
          <p className="text-text3 text-sm mb-4">You are not in any groups yet. Create one and invite the people who actually hold you accountable.</p>
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
  return (
    <div className="bg-white border border-border rounded-xl shadow-card p-5">
      <div className="flex items-center justify-between mb-1">
        <CardTag label={group.name} variant="group" />
        <Link
          to={`/groups/${group.id}`}
          className="text-xs font-medium text-burg hover:underline"
        >
          View details →
        </Link>
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text3">{group.members?.length} members</p>
        <DayTrack states={[]} showLabels />
      </div>
      <div className="space-y-0.5">
        {group.members?.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2 border-b border-cream2 last:border-0">
            <Avatar userId={m.id} initials={m.avatar_initials} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text">{m.name}</p>
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
      const { data } = await supabase
        .from('friendships')
        .select('friend_id, users!friendships_friend_id_fkey(id, name, avatar_initials, avatar_url)')
        .eq('user_id', userId)
      setFriends(data?.map(f => f.users).filter(Boolean) || [])
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

    // Add creator
    await supabase.from('group_members').insert({ group_id: group.id, user_id: userId })

    // Add selected friends directly
    for (const friendId of selected) {
      await supabase.from('group_members').insert({ group_id: group.id, user_id: friendId })
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
              Add friends {selected.size > 0 && <span className="text-burg">({selected.size} selected)</span>}
            </label>
            {friends.length === 0 ? (
              <p className="text-xs text-text3 italic">No friends yet — add them from the Friends tab first.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {friends.slice(0, 5).map(f => (
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
