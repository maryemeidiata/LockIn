import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/Logo'

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [northStar, setNorthStar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!northStar.trim()) { setError('Please share your North Star before continuing.'); return }
    setLoading(true)

    const { error: err } = await supabase
      .from('users')
      .update({ north_star: northStar.trim() })
      .eq('id', user.id)

    if (err) { setError(err.message); setLoading(false); return }

    // Save to history too
    await supabase.from('north_star_history').insert({
      user_id: user.id,
      north_star: northStar.trim(),
    })

    await refreshProfile()
    setLoading(false)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg page-fade">
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        <h1 className="font-serif text-[32px] md:text-[40px] text-text leading-tight text-center mb-3">
          What are you really working toward?
        </h1>
        <p className="text-sm text-text3 text-center max-w-sm mx-auto mb-8 leading-relaxed">
          Your North Star is the honest personal motivation behind your goals — not the goal itself.
          It is what makes the work feel worth it.
        </p>

        <form onSubmit={handleSubmit}>
          <textarea
            value={northStar}
            onChange={e => setNorthStar(e.target.value)}
            rows={4}
            placeholder="Feel in control of my health and finances before I start my career."
            className="w-full border border-border rounded-xl px-5 py-4 text-base text-text bg-white resize-none focus:outline-none focus:border-burg placeholder-text3 shadow-card mb-2"
          />
          {error && <p className="text-xs text-burg mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !northStar.trim()}
            className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>

        <p className="text-center text-xs text-text3 mt-4">
          You can update this any time. It helps us match you and detect when your goals drift.
        </p>
      </div>
    </div>
  )
}
