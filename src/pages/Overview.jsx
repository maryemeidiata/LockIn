import { useEffect, useState } from 'react'
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
          .select('user_id, users(id, name, avatar_initials, north_star)')
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
      <div className="lg:grid lg:grid-cols-[280px,1fr] lg:gap-6 lg:items-start">

        {/* Left sidebar */}
        <div className="mb-6 lg:mb-0 lg:sticky lg:top-24">
          <NorthStarBar
            northStar={profile?.north_star}
            createdAt={profile?.created_at}
            sidebar
          />
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
