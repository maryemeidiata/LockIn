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

  const { user_id, title, body, url } = await req.json()
  if (!user_id || !title || !body) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: cors })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', user_id)
    .single()

  if (!data) return new Response(JSON.stringify({ error: 'No subscription' }), { status: 404, headers: cors })

  try {
    await webpush.sendNotification(data.subscription, JSON.stringify({ title, body, url: url || '/' }))
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors })
  }
})
