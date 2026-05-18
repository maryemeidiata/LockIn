import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/Logo'

const TOTAL_STEPS = 4

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(1)
  const [northStar, setNorthStar] = useState('')
  const [notifStatus, setNotifStatus] = useState('idle') // idle | granted | denied | skipped
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function saveNorthStar() {
    if (!northStar.trim()) { setError('Please share your North Star before continuing.'); return false }
    setLoading(true)
    setError('')
    const { error: err } = await supabase
      .from('users')
      .update({ north_star: northStar.trim() })
      .eq('id', user.id)
    if (err) { setError(err.message); setLoading(false); return false }
    await supabase.from('north_star_history').insert({ user_id: user.id, north_star: northStar.trim() }).catch(() => {})
    await refreshProfile()
    setLoading(false)
    return true
  }

  async function handleNext() {
    if (step === 2) {
      const ok = await saveNorthStar()
      if (!ok) return
    }
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
    } else {
      navigate('/')
    }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) { setNotifStatus('denied'); return }
    const perm = await Notification.requestPermission()
    setNotifStatus(perm === 'granted' ? 'granted' : 'denied')
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg page-fade">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Logo size="lg" />
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i + 1 === step ? 'w-6 bg-burg' : i + 1 < step ? 'w-3 bg-burg/40' : 'w-3 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 1 && <StepWelcome onNext={handleNext} />}
        {step === 2 && (
          <StepNorthStar
            value={northStar}
            onChange={setNorthStar}
            error={error}
            loading={loading}
            onNext={handleNext}
          />
        )}
        {step === 3 && <StepHowItWorks onNext={handleNext} />}
        {step === 4 && (
          <StepNotifications
            status={notifStatus}
            onRequest={requestNotifications}
            onSkip={() => navigate('/')}
            onDone={() => navigate('/')}
          />
        )}
      </div>
    </div>
  )
}

function StepWelcome({ onNext }) {
  return (
    <div className="text-center">
      <h1 className="font-serif text-[32px] text-text leading-tight mb-4">
        Accountability, done right.
      </h1>
      <p className="text-sm text-text3 leading-relaxed mb-8 max-w-sm mx-auto">
        LockIn keeps you honest — not with streaks or badges, but with real people who notice when you show up and when you don't.
      </p>

      <div className="space-y-3 mb-10 text-left">
        {[
          {
            icon: '🧭',
            title: 'Set your North Star',
            desc: 'The honest reason behind everything you're working on.',
          },
          {
            icon: '👥',
            title: 'Join a small group',
            desc: 'Up to 6 people. You commit together, you hold each other accountable.',
          },
          {
            icon: '✅',
            title: 'Check in every day',
            desc: 'One tap. Your group sees it. That's the whole point.',
          },
        ].map(item => (
          <div key={item.title} className="flex items-start gap-4 bg-white border border-border rounded-xl p-4 shadow-card">
            <span className="text-2xl mt-0.5">{item.icon}</span>
            <div>
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="text-xs text-text3 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors"
      >
        Let's go
      </button>
    </div>
  )
}

function StepNorthStar({ value, onChange, error, loading, onNext }) {
  return (
    <div>
      <h1 className="font-serif text-[28px] text-text leading-tight text-center mb-3">
        What are you really working toward?
      </h1>
      <p className="text-sm text-text3 text-center leading-relaxed mb-8 max-w-sm mx-auto">
        Your North Star is the honest motivation behind your goals — not the goal itself. What makes the hard work feel worth it?
      </p>

      <div className="bg-cream2 border border-border rounded-xl p-3 mb-4 text-xs text-text3 italic space-y-1.5">
        <p>"Feel in control of my health before I start my career."</p>
        <p>"Prove to myself I can finish something I start."</p>
        <p>"Be someone my kids can look up to."</p>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        autoFocus
        placeholder="Write yours here..."
        className="w-full border border-border rounded-xl px-5 py-4 text-base text-text bg-white resize-none focus:outline-none focus:border-burg placeholder-text3 shadow-card mb-2"
      />
      {error && <p className="text-xs text-burg mb-3">{error}</p>}

      <button
        onClick={onNext}
        disabled={loading || !value.trim()}
        className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save & continue'}
      </button>
      <p className="text-center text-xs text-text3 mt-3">
        You can always update this from your profile.
      </p>
    </div>
  )
}

function StepHowItWorks({ onNext }) {
  return (
    <div>
      <h1 className="font-serif text-[28px] text-text leading-tight text-center mb-3">
        Here's how a week works
      </h1>
      <p className="text-sm text-text3 text-center leading-relaxed mb-8 max-w-sm mx-auto">
        Every week is a fresh start. Here's the rhythm:
      </p>

      <div className="space-y-0 mb-8">
        {[
          {
            day: 'Mon',
            color: 'bg-burg',
            title: 'Set your commitment',
            desc: 'One specific thing you\'ll do this week. Add a consequence if you miss it.',
          },
          {
            day: 'Tue–Sat',
            color: 'bg-burg/70',
            title: 'Check in daily',
            desc: 'One tap to confirm you did it. Miss a day? Submit an excuse — your group votes.',
          },
          {
            day: 'Sun',
            color: 'bg-burg/40',
            title: 'Reflect',
            desc: 'How did the week go? Your streak and history build over time.',
          },
        ].map((item, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 ${item.color} rounded-full flex items-center justify-center text-cream text-[10px] font-bold flex-shrink-0`}>
                {item.day.split('–')[0].slice(0, 2)}
              </div>
              {i < 2 && <div className="w-0.5 h-4 bg-border mt-1" />}
            </div>
            <div className="pb-5">
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="text-xs text-text3 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-cream2 border border-border rounded-xl p-4 mb-6 text-xs text-text2 leading-relaxed">
        <strong className="text-text">First step:</strong> Go to <strong>Groups</strong> and create your first group, then invite the people who hold you accountable. Or wait to be invited.
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors"
      >
        Got it
      </button>
    </div>
  )
}

function StepNotifications({ status, onRequest, onSkip, onDone }) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-5">🔔</div>
      <h1 className="font-serif text-[28px] text-text leading-tight mb-3">
        Never miss a check-in
      </h1>
      <p className="text-sm text-text3 leading-relaxed mb-8 max-w-sm mx-auto">
        LockIn sends you a daily reminder at 9am, a Sunday goal-setting nudge, and lets your friends nudge you when you go silent.
      </p>

      {status === 'granted' ? (
        <div className="space-y-4">
          <div className="bg-cream2 border border-border rounded-xl p-4 text-sm text-text">
            Notifications enabled. You're all set.
          </div>
          <button
            onClick={onDone}
            className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Start using LockIn
          </button>
        </div>
      ) : status === 'denied' ? (
        <div className="space-y-4">
          <div className="bg-cream2 border border-border rounded-xl p-4 text-sm text-text2">
            Notifications blocked. You can enable them later in your browser settings.
          </div>
          <button
            onClick={onDone}
            className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Start using LockIn
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={onRequest}
            className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Enable notifications
          </button>
          <button
            onClick={onSkip}
            className="w-full py-3.5 text-text3 text-sm hover:text-text2 transition-colors"
          >
            Maybe later
          </button>
        </div>
      )}
    </div>
  )
}
