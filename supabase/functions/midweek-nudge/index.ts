import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:hello@lockin.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function getWeekStart() {
  const d = new Date()
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

serve(async () => {
  const weekStart = getWeekStart()

  // Get all groups
  const { data: groups } = await supabase.from('groups').select('id, name')
  if (!groups?.length) return new Response('no groups', { status: 200 })

  let totalNotified = 0

  for (const group of groups) {
    // Get all members of this group
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, users(id, name)')
      .eq('group_id', group.id)

    if (!members?.length) continue

    // Get commitments for this week in this group
    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, user_id')
      .eq('group_id', group.id)
      .eq('week_start', weekStart)

    if (!commitments?.length) continue

    // Get all checkins for those commitments
    const commitmentIds = commitments.map(c => c.id)
    const { data: checkins } = await supabase
      .from('checkins')
      .select('commitment_id, user_id')
      .in('commitment_id', commitmentIds)

    // Find members with zero check-ins so far this week
    const silent = commitments.filter(c => {
      const userCheckins = checkins?.filter(ci => ci.user_id === c.user_id) || []
      return userCheckins.length === 0
    })

    if (!silent.length) continue

    const silentNames = silent
      .map(c => members.find(m => m.user_id === c.user_id)?.users?.name?.split(' ')[0])
      .filter(Boolean)

    // Notify the OTHER members (not the silent ones)
    const silentIds = new Set(silent.map(c => c.user_id))
    const activeMembers = members.filter(m => !silentIds.has(m.user_id))

    for (const member of activeMembers) {
      const { data: sub } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', member.user_id)
        .single()

      if (!sub) continue

      const nameList = silentNames.join(', ')
      const body = silentNames.length === 1
        ? `${nameList} hasn't checked in yet this week. Send them a nudge?`
        : `${nameList} haven't checked in yet this week. Send them a nudge?`

      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({
          title: `Check in on your group 👀`,
          body,
          url: `/groups/${group.id}`,
        }))
        totalNotified++
      } catch (_) { /* subscription may be expired */ }
    }
  }

  return new Response(JSON.stringify({ totalNotified }), { status: 200 })
})
