import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:hello@lockin.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function getTodayDayIndex() {
  // 0 = Monday … 6 = Sunday (matching the app's week convention)
  const d = new Date()
  return (d.getUTCDay() + 6) % 7
}

function getWeekStart() {
  const d = new Date()
  const day = d.getUTCDay() // 0 = Sunday
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

serve(async () => {
  const weekStart = getWeekStart()
  const todayIdx = getTodayDayIndex()

  // Get all users with a push subscription and an active commitment this week
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('user_id, subscription')

  if (!subs?.length) return new Response('no subs', { status: 200 })

  const results = await Promise.allSettled(
    subs.map(async ({ user_id, subscription }) => {
      // Does this user have a commitment this week?
      const { data: commitments } = await supabase
        .from('commitments')
        .select('id')
        .eq('user_id', user_id)
        .eq('week_start', weekStart)

      if (!commitments?.length) return

      const commitmentIds = commitments.map(c => c.id)

      // Have they already checked in today?
      const { data: checkins } = await supabase
        .from('checkins')
        .select('id')
        .in('commitment_id', commitmentIds)
        .eq('day_of_week', todayIdx)

      if (checkins?.length) return // already checked in today

      await webpush.sendNotification(subscription, JSON.stringify({
        title: "Don't forget to check in 🔒",
        body: "Log today's progress before the day slips away.",
        url: '/',
      }))
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return new Response(JSON.stringify({ sent }), { status: 200 })
})
