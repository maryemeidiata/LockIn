import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, formatDate, buildDayStates, getDayIndexFromTimestamp } from '../lib/weekUtils'
import { getCache, setCache } from '../lib/cache'
import NorthStarBar from '../components/NorthStarBar'
import GroupCard from '../components/GroupCard'
import MatchCard from '../components/MatchCard'
import VoteCard from '../components/VoteCard'
import InsightCard from '../components/InsightCard'
import HeroBanner from '../components/HeroBanner'
import LoadingPulse from '../components/ui/LoadingPulse'
import NotificationBanner from '../components/NotificationBanner'
import { getWeekOfMonth } from '../lib/weekUtils'
import { useNotifications } from '../hooks/useNotifications'
import { askAI } from '../lib/ai'

export default function Overview() {
  const { user, profile } = useAuth()
  const cached = getCache('overview')
  const [loading, setLoading] = useState(!cached)
  const [groups, setGroups] = useState(cached?.groups ?? [])
  const [match, setMatch] = useState(cached?.match ?? null)
  const [pendingVotes, setPendingVotes] = useState(cached?.pendingVotes ?? [])
  const [showNotifBanner, setShowNotifBanner] = useState(false)
  const { permission, requestPermission } = useNotifications(user?.id)
  const [insight, setInsight] = useState(cached?.insight ?? null)

  const weekStart = getCurrentWeekStartStr()
  const firstName = profile?.name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  useEffect(() => {
    if (permission === 'default' && !sessionStorage.getItem('notif-dismissed')) {
      setShowNotifBanner(true)
    }
  }, [permission])

  async function fetchAll() {
    if (!getCache('overview')) setLoading(true)
    await Promise.all([fetchGroups(), fetchMatch(), fetchPendingVotes(), fetchInsight()])
    setLoading(false)
  }

  function saveCache(updates) {
    setCache('overview', {
      groups, match, pendingVotes, insight,
      ...updates,
    })
  }

  async function fetchGroups() {
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id)

    if (!memberships?.length) return

    const groupData = await Promise.all(
      memberships.map(async ({ groups: group }) => {
        if (!group) return null
        // Get members
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id, users(id, name, avatar_initials, avatar_url, north_star)')
          .eq('group_id', group.id)

        // Get commitments for this week
        const { data: commitments } = await supabase
          .from('commitments')
          .select('id, user_id, commitment_text')
          .eq('group_id', group.id)
          .eq('week_start', weekStart)

        // Get checkins for those commitments
        const commitmentIds = commitments?.map(c => c.id) || []
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

        const memberList = (members || []).map(m => {
          const u = m.users
          const commitment = commitments?.find(c => c.user_id === m.user_id)
          const userCheckins = checkins.filter(ci => ci.user_id === m.user_id)
          const checkinDays = userCheckins.map(ci => ci.day_of_week)
          const userExcuses = excuses.filter(e => e.user_id === m.user_id)
          const excusedDays = userExcuses.filter(e => e.status === 'approved').map(e => getDayIndexFromTimestamp(e.submitted_at))
          const rejectedDays = userExcuses.filter(e => e.status === 'rejected').map(e => getDayIndexFromTimestamp(e.submitted_at))
          return {
            ...u,
            commitment_text: commitment?.commitment_text || '',
            dayStates: buildDayStates(checkinDays, weekStart, excusedDays, rejectedDays),
          }
        })

        return { ...group, members: memberList }
      })
    )

    const filtered = groupData.filter(Boolean)
    setGroups(filtered)
    saveCache({ groups: filtered })
  }

  async function fetchMatch() {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
      .eq('week_start', weekStart)
      .limit(1)

    if (!matches?.length) return

    const m = matches[0]
    const otherId = m.user_id_1 === user.id ? m.user_id_2 : m.user_id_1

    const { data: otherUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', otherId)
      .single()

    const { data: otherCommitment } = await supabase
      .from('commitments')
      .select('commitment_text')
      .eq('user_id', otherId)
      .eq('week_start', weekStart)
      .single()

    const matchData = { ...m, other_user: otherUser, other_commitment: otherCommitment?.commitment_text }
    setMatch(matchData)
    saveCache({ match: matchData })
  }

  async function fetchPendingVotes() {
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
    if (!myGroups?.length) return

    const groupIds = myGroups.map(g => g.group_id)

    const { data: submissions } = await supabase
      .from('missed_submissions')
      .select('*, user:users(*), commitment:commitments(group_id, commitment_text)')
      .neq('user_id', user.id)
    if (!submissions?.length) return

    const relevant = submissions.filter(s => groupIds.includes(s.commitment?.group_id))

    const { data: myVotes } = await supabase
      .from('votes')
      .select('missed_submission_id')
      .eq('voter_id', user.id)

    const voted = new Set(myVotes?.map(v => v.missed_submission_id) || [])
    const pending = relevant.filter(s => !voted.has(s.id))
    setPendingVotes(pending)
    saveCache({ pendingVotes: pending })
  }

  async function fetchInsight() {
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.length) {
      setInsight(data[0])
      saveCache({ insight: data[0] })
    }
  }

  if (loading) {
    return (
      <div>
        <div className="loading-pulse h-44 rounded-2xl mb-6" />
        <div className="lg:grid lg:grid-cols-[280px,1fr] lg:gap-6">
          <div className="loading-pulse h-44 rounded-2xl mb-4 lg:mb-0" />
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="loading-pulse h-44 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Hero banner — full width */}
      <HeroBanner
        greeting={greeting}
        firstName={firstName}
        date={formatDate()}
        week={getWeekOfMonth()}
      />

      {/* Two-column layout below banner */}
      <div className="lg:grid lg:grid-cols-[340px,1fr] lg:gap-6 lg:items-start">

        {/* Left sidebar */}
        <div className="mb-6 lg:mb-0 lg:sticky lg:top-24 space-y-4">
          <NorthStarBar
            northStar={profile?.north_star}
            createdAt={profile?.created_at}
            sidebar
          />
          <SidebarStats groups={groups} pendingVotes={pendingVotes} match={match} />
          <AskAICard profile={profile} groups={groups} match={match} />
        </div>

        {/* Right content */}
        <div className="space-y-4">
          {showNotifBanner && (
            <NotificationBanner
              onEnable={async () => {
                await requestPermission(user?.id)
                setShowNotifBanner(false)
              }}
              onDismiss={() => {
                sessionStorage.setItem('notif-dismissed', '1')
                setShowNotifBanner(false)
              }}
            />
          )}

          {groups.length === 0 ? (
            <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
              <p className="text-sm text-text3 mb-3">You are not in any groups yet. Groups are how accountability happens.</p>
              <a href="/groups" className="inline-block px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors">
                Create a group
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}

          {(match || pendingVotes.length > 0) && (
            <div className="flex flex-col gap-4">
              {match && <MatchCard match={match} onCheckIn={() => {}} />}
              {pendingVotes.slice(0, 1).map(sub => (
                <VoteCard key={sub.id} submission={sub} onVoted={fetchPendingVotes} />
              ))}
            </div>
          )}

          {insight && <InsightCard insight={insight} />}
        </div>
      </div>
    </div>
  )
}

function SidebarStats({ groups, pendingVotes, match }) {
  const totalMembers = groups.reduce((sum, g) => sum + (g.members?.length || 0), 0)
  const totalCheckedIn = groups.reduce((sum, g) => {
    return sum + (g.members?.filter(m => m.dayStates?.some(s => s === 'done')).length || 0)
  }, 0)

  const stats = [
    { label: 'Groups', value: groups.length },
    { label: 'Checked in', value: `${totalCheckedIn}/${totalMembers}` },
    { label: 'Pending votes', value: pendingVotes.length },
  ]

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text3 mb-4">This week</p>
      <div className="space-y-3">
        {stats.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-xs text-text3">{s.label}</span>
            <span className="text-sm font-semibold text-text">{s.value}</span>
          </div>
        ))}
      </div>
      {match && (
        <div className="mt-4 pt-4 border-t border-cream2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text3 mb-1">Your match</p>
          <p className="text-sm font-medium text-burg">{match.other_user?.name}</p>
          {match.other_commitment && (
            <p className="text-[11px] text-text3 mt-0.5 truncate">{match.other_commitment}</p>
          )}
        </div>
      )}
    </div>
  )
}

const AI_NAME = 'Stella'
const CHAT_KEY = 'stella-chat-history'

function buildSystemPrompt({ profile, groups, match }) {
  const name = profile?.name?.split(' ')[0] || 'the user'
  const northStar = profile?.north_star || 'not set yet'

  const commitments = groups.flatMap(g =>
    (g.members || [])
      .filter(m => m.id === profile?.id && m.commitment_text)
      .map(m => `"${m.commitment_text}" (in group ${g.name})`)
  )

  const checkinSummary = groups.flatMap(g =>
    (g.members || [])
      .filter(m => m.id === profile?.id && m.dayStates)
      .map(m => {
        const done = m.dayStates.filter(s => s === 'done').length
        return `${done}/7 days checked in this week`
      })
  )

  const groupNames = groups.map(g => g.name).join(', ')
  const matchName = match?.other_user?.name
  const matchCommitment = match?.other_commitment

  return `You are Stella, a warm and concise accountability coach inside the LockIn app.

User's name: ${name}
North Star (long-term motivation): ${northStar}
Groups: ${groupNames || 'none yet'}
This week's commitment: ${commitments.length ? commitments.join('; ') : 'not set yet'}
Check-in progress: ${checkinSummary.length ? checkinSummary.join('; ') : 'no data yet'}
${matchName ? `Accountability match this week: ${matchName}${matchCommitment ? `, working on "${matchCommitment}"` : ''}` : ''}

Speak directly to ${name}. Be specific, warm, and brief — under 60 words per reply. Reference their actual goals and progress when relevant.`
}

function AskAICard({ profile, groups, match }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CHAT_KEY) || '[]') } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-40)))
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    const systemMsg = {
      role: 'system',
      content: buildSystemPrompt({ profile, groups, match }),
    }

    try {
      const reply = await askAI([systemMsg, ...next])
      setMessages(prev => [...prev, { role: 'assistant', content: reply || 'No response received.' }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    }
    setLoading(false)
  }

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text3">{AI_NAME}</p>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); localStorage.removeItem(CHAT_KEY) }} className="text-[10px] text-text3 hover:text-burg transition-colors">
            Clear
          </button>
        )}
      </div>

      {messages.length === 0 && !loading && (
        <p className="text-xs text-text3 leading-relaxed">
          Ask anything, is my goal feasible? What should I commit to this week?
        </p>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`text-xs leading-relaxed px-3 py-2 rounded-xl max-w-[88%] ${
                m.role === 'user'
                  ? 'bg-burg text-cream rounded-br-sm'
                  : 'bg-cream2 text-text rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="text-xs px-3 py-2 rounded-xl rounded-bl-sm bg-cream2 text-text3">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask a question…"
          className="flex-1 text-xs bg-cream2 border border-border rounded-[10px] px-3 py-2 text-text placeholder:text-text3 focus:outline-none focus:ring-1 focus:ring-burg/30"
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="px-3 py-2 bg-burg text-cream text-xs font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}
