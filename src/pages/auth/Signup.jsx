import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)

    const initials = name.trim().split(' ')
      .map(w => w[0]).join('').toUpperCase().slice(0, 2)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    // Profile row created by trigger — wait a moment then update
    await new Promise(r => setTimeout(r, 800))
    await supabase.from('users').upsert({
      id: (await supabase.auth.getUser()).data.user?.id,
      email,
      name: name.trim(),
      avatar_initials: initials,
    })

    // Auto-join the welcome group
    const WELCOME_GROUP_ID = 'dcc5b2d7-c0f6-4a44-9250-37c51466cf88'
    const newUserId = (await supabase.auth.getUser()).data.user?.id
    if (newUserId) {
      await supabase.from('group_members').insert({
        group_id: WELCOME_GROUP_ID,
        user_id: newUserId,
        role: 'member',
      })
    }

    setLoading(false)
    const pendingToken = sessionStorage.getItem('pending_invite_token')
    if (pendingToken) {
      sessionStorage.removeItem('pending_invite_token')
      navigate(`/join/${pendingToken}`)
    } else {
      navigate('/onboarding')
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-white border border-border rounded-xl shadow-card p-8">
          <h1 className="font-serif text-2xl text-text mb-1">Create account</h1>
          <p className="text-sm text-text3 mb-6">Join your first accountability group</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text bg-white focus:outline-none focus:border-burg placeholder-text3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text bg-white focus:outline-none focus:border-burg placeholder-text3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text2 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Minimum 8 characters"
                className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text bg-white focus:outline-none focus:border-burg placeholder-text3"
              />
            </div>
            {error && <p className="text-xs text-burg">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text3 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-burg font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
