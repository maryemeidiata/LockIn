import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { email, group_id, group_name, inviter_name } = await req.json()
    if (!email || !group_id) {
      return new Response(JSON.stringify({ error: 'email and group_id required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: { user: caller } } = await admin.auth.getUser(jwt)
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already has an account
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single()

    if (existingUser) {
      // Check if already a member
      const { data: alreadyMember } = await admin
        .from('group_members')
        .select('user_id')
        .eq('group_id', group_id)
        .eq('user_id', existingUser.id)
        .single()

      if (alreadyMember) {
        return new Response(JSON.stringify({ error: 'This person is already in the group' }), {
          status: 409, headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      // Already registered — add them directly
      await admin.from('group_members').insert({ group_id, user_id: existingUser.id })
      return new Response(JSON.stringify({ ok: true, addedDirectly: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // New user — record invitation and send invite email
    await admin.from('invitations').upsert({
      group_id,
      invited_email: normalizedEmail,
      invited_by: caller.id,
      status: 'pending',
    }, { onConflict: 'group_id,invited_email' })

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: 'https://lockin-app-azure.vercel.app/',
      data: { group_id, group_name, inviter_name },
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, addedDirectly: false }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
