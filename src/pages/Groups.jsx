import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, buildDayStates } from '../lib/weekUtils'
import { getCache, setCache, clearCache } from '../lib/cache'
import CardTag from '../components/ui/CardTag'
import Avatar from '../components/ui/Avatar'
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

        const memberList = (members || []).map(m => {
          const commitment = commitments?.find(c => c.user_id === m.user_id)
          const checkinDays = (checkins || [])
            .filter(ci => ci.user_id === m.user_id)
            .map(ci => ci.day_of_week)
          return {
            ...m.users,
            commitment_text: commitment?.commitment_text || '',
            dayStates: buildDayStates(checkinDays, weekStart),
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <CardTag label={group.name} variant="group" />
          <p className="text-xs text-text3 mt-1">{group.members?.length} members</p>
        </div>
        <Link
          to={`/groups/${group.id}`}
          className="text-xs font-medium text-burg hover:underline"
        >
          View details
        </Link>
      </div>
      <div className="space-y-0.5">
        {group.members?.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2 border-b border-cream2 last:border-0">
            <Avatar userId={m.id} initials={m.avatar_initials} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text">{m.name}</p>
              <p className="text-[11px] text-text3 truncate">{m.commitment_text || 'No commitment set'}</p>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {m.dayStates?.map((state, i) => (
                <div
                  key={i}
                  style={{
                    width: 9, height: 9, borderRadius: 2,
                    background: state === 'done' ? 'var(--burg)' : state === 'today' ? 'var(--burg-muted)' : 'var(--cream2)',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateGroupModal({ onClose, onCreated, userId }) {
  const [name, setName] = useState(() => sessionStorage.getItem('cg_name') || '')
  const [emails, setEmails] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('cg_emails')) || [''] } catch { return [''] }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleNameChange(val) {
    setName(val)
    sessionStorage.setItem('cg_name', val)
  }

  function handleEmailChange(i, val) {
    const next = [...emails]
    next[i] = val
    setEmails(next)
    sessionStorage.setItem('cg_emails', JSON.stringify(next))
  }

  function handleAddEmail() {
    const next = [...emails, '']
    setEmails(next)
    sessionStorage.setItem('cg_emails', JSON.stringify(next))
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

    await supabase.from('group_members').insert({ group_id: group.id, user_id: userId })

    const validEmails = emails.filter(e => e.trim())
    for (const email of validEmails) {
      await supabase.from('invitations').insert({
        group_id: group.id,
        invited_by: userId,
        invited_email: email.trim().toLowerCase(),
      })
    }

    sessionStorage.removeItem('cg_name')
    sessionStorage.removeItem('cg_emails')
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
            <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Invite by email (optional)</label>
            {emails.map((email, i) => (
              <input
                key={i}
                value={email}
                onChange={e => handleEmailChange(i, e.target.value)}
                placeholder="friend@example.com"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none focus:border-burg placeholder-text3 mb-2"
              />
            ))}
            {emails.length < 5 && (
              <button type="button" onClick={handleAddEmail} className="text-xs text-burg hover:underline">
                + Add another email
              </button>
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
