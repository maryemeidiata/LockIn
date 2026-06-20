import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user: caller } } = await supabase.auth.getUser(jwt)
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
  }

  const { to_user_id, message } = await req.json()
  if (!to_user_id) {
    return new Response(JSON.stringify({ error: 'Missing to_user_id' }), { status: 400, headers: cors })
  }

  // Rate limit: max 3 nudges per sender per day
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('nudge_log')
    .select('id', { count: 'exact', head: true })
    .eq('from_user_id', caller.id)
    .gt('sent_at', dayAgo)

  if ((count || 0) >= 3) {
    return new Response(JSON.stringify({ error: 'Daily nudge limit reached (3 per day)' }), { status: 429, headers: cors })
  }

  // Get sender name
  const { data: sender } = await supabase
    .from('users')
    .select('name')
    .eq('id', caller.id)
    .single()

  const senderName = sender?.name || 'Someone from your group'
  const senderFirst = senderName.split(' ')[0]

  // Get recipient name + email from auth
  const { data: recipientAuth } = await supabase.auth.admin.getUserById(to_user_id)
  const recipientEmail = recipientAuth?.user?.email
  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: 'Recipient has no email on file' }), { status: 404, headers: cors })
  }

  const { data: recipientProfile } = await supabase
    .from('users')
    .select('name')
    .eq('id', to_user_id)
    .single()

  const recipientFirst = recipientProfile?.name?.split(' ')[0] || 'there'

  const nudgeBody = message?.trim()
    ? message.trim()
    : `${senderFirst} is rooting for you — don't give up!`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DDD0C8;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1A0A10 0%,#3A0F1E 100%);padding:28px 32px;">
              <p style="margin:0;font-size:22px;color:#FAF6F1;font-weight:600;letter-spacing:-0.5px;">LockIn 🔒</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A0A10;">Hey ${recipientFirst} 💪</p>
              <p style="margin:0 0 24px;font-size:15px;color:#5C3347;line-height:1.6;">
                <strong>${senderName}</strong> sent you a nudge:
              </p>
              <div style="background:#F2EAE0;border-left:3px solid #6B1E3A;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0;font-size:16px;color:#1A0A10;font-style:italic;line-height:1.5;">"${nudgeBody}"</p>
              </div>
              <a href="https://lockin-app-azure.vercel.app/"
                style="display:inline-block;background:#6B1E3A;color:#FAF6F1;text-decoration:none;font-size:14px;font-weight:600;padding:14px 28px;border-radius:10px;letter-spacing:0.2px;">
                Check in now →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E8DDD0;">
              <p style="margin:0;font-size:11px;color:#9A6B7A;line-height:1.6;">
                You received this because someone in your LockIn group nudged you.<br>
                Nudges are limited to 3 per person per day.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LockIn <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `${senderFirst} sent you a nudge 💪`,
      html,
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.json()
    return new Response(JSON.stringify({ error: err.message || 'Email failed' }), { status: 500, headers: cors })
  }

  // Log the nudge
  await supabase.from('nudge_log').insert({
    from_user_id: caller.id,
    to_user_id,
    message: nudgeBody,
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
