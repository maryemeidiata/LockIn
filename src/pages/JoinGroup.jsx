import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function JoinGroup() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState('loading') // loading | joining | joined | invalid | already_member

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Save token so we can auto-join after login/signup
      sessionStorage.setItem('pending_invite_token', token)
      navigate(`/signup?invite=${token}`, { replace: true })
      return
    }
    handleJoin()
  }, [user, authLoading])

  async function handleJoin() {
    setStatus('joining')

    const { data: invite } = await supabase
      .from('invite_links')
      .select('group_id')
      .eq('token', token)
      .maybeSingle()

    if (!invite) {
      setStatus('invalid')
      return
    }

    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', invite.group_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      setStatus('already_member')
      setTimeout(() => navigate(`/groups/${invite.group_id}`, { replace: true }), 1500)
      return
    }

    await supabase.from('group_members').insert({
      group_id: invite.group_id,
      user_id: user.id,
      role: 'member',
    })

    setStatus('joined')
    setTimeout(() => navigate(`/groups/${invite.group_id}`, { replace: true }), 1500)
  }

  const messages = {
    loading: 'Checking invite...',
    joining: 'Joining group...',
    joined: 'You\'re in! Redirecting...',
    already_member: 'You\'re already in this group. Redirecting...',
    invalid: 'This invite link is invalid or has expired.',
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="bg-white border border-border rounded-2xl shadow-card p-8 max-w-sm w-full text-center">
        <div className="text-2xl mb-3">
          {status === 'joined' ? '🎉' : status === 'invalid' ? '❌' : '⏳'}
        </div>
        <p className="text-sm text-text">{messages[status]}</p>
        {status === 'invalid' && (
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px]"
          >
            Go home
          </button>
        )}
      </div>
    </div>
  )
}
