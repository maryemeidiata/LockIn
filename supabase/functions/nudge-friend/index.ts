import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails('mailto:hello@lockin.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify the caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

  const { data: { user } } = await createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!)
    .auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

  const { to_user_id, message } = await req.json()
  if (!to_user_id) return new Response(JSON.stringify({ error: 'Missing to_user_id' }), { status: 400, headers: cors })

  // Rate limit: max 3 nudges per sender per day
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('nudge_log')
    .select('id', { count: 'exact', head: true })
    .eq('from_user_id', user.id)
    .gt('sent_at', dayAgo)

  if ((count || 0) >= 3) {
    return new Response(JSON.stringify({ error: 'Daily nudge limit reached' }), { status: 429, headers: cors })
  }

  // Get sender name
  const { data: sender } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  const senderName = sender?.name?.split(' ')[0] || 'Your friend'

  // Get recipient's push subscription
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', to_user_id)
    .single()

  if (!sub) return new Response(JSON.stringify({ error: 'No subscription for recipient' }), { status: 404, headers: cors })

  const notifBody = message?.trim()
    ? message.trim()
    : `${senderName} is rooting for you — don't give up!`

  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify({
      title: `${senderName} sent you a nudge 💪`,
      body: notifBody,
      url: '/',
    }))
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors })
  }

  // Log the nudge
  await supabase.from('nudge_log').insert({
    from_user_id: user.id,
    to_user_id,
    message: notifBody,
  })

  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
