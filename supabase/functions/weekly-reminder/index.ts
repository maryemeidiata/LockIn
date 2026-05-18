import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:hello@lockin.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function getNextWeekStart() {
  const d = new Date()
  // Next Monday
  const daysUntilMonday = (8 - d.getUTCDay()) % 7 || 7
  const nextMonday = new Date(d)
  nextMonday.setUTCDate(d.getUTCDate() + daysUntilMonday)
  return nextMonday.toISOString().slice(0, 10)
}

serve(async () => {
  const nextWeek = getNextWeekStart()

  // All users with a push subscription
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')

  if (!subs?.length) return new Response('no subs', { status: 200 })

  const results = await Promise.allSettled(
    subs.map(async ({ user_id, subscription }) => {
      // Check they're in at least one group (worth reminding)
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user_id)

      if (!memberships?.length) return

      // Check if they already set a commitment for next week
      const groupIds = memberships.map(m => m.group_id)
      const { data: nextCommitments } = await supabase
        .from('commitments')
        .select('id')
        .eq('user_id', user_id)
        .eq('week_start', nextWeek)
        .in('group_id', groupIds)

      if (nextCommitments?.length) return // already set

      await webpush.sendNotification(subscription, JSON.stringify({
        title: "Set your goal for next week 🎯",
        body: "Your group is waiting. What will you commit to?",
        url: '/groups',
      }))
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return new Response(JSON.stringify({ sent }), { status: 200 })
})
