import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [resetSent, setResetSent] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    navigate('/')
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setResetSent(true)
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-white border border-border rounded-xl shadow-card p-8">
          {mode === 'login' ? (
            <>
              <h1 className="font-serif text-2xl text-text mb-1">Welcome back</h1>
              <p className="text-sm text-text3 mb-6">Sign in to your account</p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-text2 uppercase tracking-wider">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError('') }}
                      className="text-xs text-burg hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text bg-white focus:outline-none focus:border-burg placeholder-text3"
                  />
                </div>
                {error && <p className="text-xs text-burg">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-60 mt-2"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </>
          ) : resetSent ? (
            <>
              <h1 className="font-serif text-2xl text-text mb-1">Check your email</h1>
              <p className="text-sm text-text3 mb-6">
                We sent a reset link to <strong>{email}</strong>. Click the link to set a new password.
              </p>
              <button
                onClick={() => { setMode('login'); setResetSent(false) }}
                className="w-full py-3 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="font-serif text-2xl text-text mb-1">Reset password</h1>
              <p className="text-sm text-text3 mb-6">Enter your email and we'll send a reset link.</p>

              <form onSubmit={handleReset} className="space-y-4">
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
                {error && <p className="text-xs text-burg">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError('') }}
                  className="w-full py-2 text-sm text-text3 hover:text-text2 transition-colors"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-text3 mt-5">
          No account?{' '}
          <Link to="/signup" className="text-burg font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
