import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/Logo'

const TOTAL_STEPS = 5

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState('idle')
  const [northStar, setNorthStar] = useState('')
  const [notifStatus, setNotifStatus] = useState('idle')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!username) { setUsernameStatus('idle'); return }
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    const t = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id').eq('username', username).maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(t)
  }, [username])

  function persistNorthStar(text) {
    if (!text.trim() || !user?.id) return
    supabase.from('users').update({ north_star: text.trim() }).eq('id', user.id)
      .then(({ data, error: err }) => {
        if (err || !data?.length) {
          supabase.from('users').upsert({ id: user.id, north_star: text.trim() }).catch(() => {})
        }
      }).catch(() => {})
    supabase.from('north_star_history').insert({ user_id: user.id, north_star: text.trim() }).catch(() => {})
    refreshProfile().catch(() => {})
  }

  async function handleNext() {
    setError('')
    if (step === 2) {
      if (username && usernameStatus === 'available') {
        await supabase.from('users').update({ username }).eq('id', user.id)
        await refreshProfile()
      }
    }
    if (step === 3 && !northStar.trim()) {
      setError('Please share your North Star before continuing.')
      return
    }
    if (step === 3) { try { persistNorthStar(northStar) } catch (_) {} }
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
    } else {
      await refreshProfile()
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

        {step === 1 && <StepWelcome onNext={handleNext} />}
        {step === 2 && (
          <StepUsername
            value={username}
            onChange={setUsername}
            status={usernameStatus}
            onNext={handleNext}
            onSkip={() => setStep(s => s + 1)}
          />
        )}
        {step === 3 && (
          <StepNorthStar
            value={northStar}
            onChange={setNorthStar}
            error={error}
            loading={loading}
            onNext={handleNext}
            onSkip={() => setStep(s => s + 1)}
          />
        )}
        {step === 4 && <StepHowItWorks onNext={handleNext} />}
        {step === 5 && (
          <StepNotifications
            status={notifStatus}
            onRequest={requestNotifications}
            onSkip={async () => { await refreshProfile(); navigate('/') }}
            onDone={async () => { await refreshProfile(); navigate('/') }}
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
        LockIn keeps you honest, not with streaks or badges, but with real people who notice when you show up and when you don't.
      </p>

      <div className="space-y-3 mb-10 text-left">
        {[
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            ),
            title: 'Set your North Star',
            desc: "The honest reason behind everything you're working on.",
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            ),
            title: 'Join a small group',
            desc: 'Up to 6 people. You commit together, you hold each other accountable.',
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            ),
            title: 'Check in every day',
            desc: "One tap. Your group sees it. That's the whole point.",
          },
        ].map(item => (
          <div key={item.title} className="flex items-start gap-4 bg-white border border-border rounded-xl p-4 shadow-card">
            <div className="w-8 h-8 rounded-full bg-cream2 flex items-center justify-center flex-shrink-0 mt-0.5 text-burg">
              {item.icon}
            </div>
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

function StepUsername({ value, onChange, status, onNext, onSkip }) {
  return (
    <div>
      <h1 className="font-serif text-[28px] text-text leading-tight text-center mb-3">
        Pick your @handle
      </h1>
      <p className="text-sm text-text3 text-center leading-relaxed mb-8 max-w-sm mx-auto">
        This is how your crew will find and invite you. Lowercase, no spaces.
      </p>

      <div className="relative mb-1">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text2 font-medium select-none">@</span>
        <input
          value={value}
          onChange={e => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
          placeholder="yourhandle"
          maxLength={20}
          autoFocus
          className="w-full border border-border rounded-xl pl-8 pr-10 py-4 text-base text-text bg-white focus:outline-none focus:border-burg placeholder-text3 shadow-card"
        />
        {status === 'checking' && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-burg border-t-transparent rounded-full animate-spin" />
        )}
        {status === 'available' && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 font-semibold">✓</span>
        )}
        {(status === 'taken' || status === 'invalid') && value.length > 0 && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-burg font-semibold">✗</span>
        )}
      </div>

      <p className={`text-xs mb-6 min-h-[16px] ${status === 'available' ? 'text-green-600' : status === 'taken' ? 'text-burg' : 'text-text3'}`}>
        {status === 'idle' && 'Letters, numbers, and _ only. 3–20 characters.'}
        {status === 'checking' && 'Checking…'}
        {status === 'available' && `@${value} is available!`}
        {status === 'taken' && 'That handle is taken. Try another.'}
        {status === 'invalid' && value.length > 0 && 'Letters, numbers, and _ only. At least 3 characters.'}
      </p>

      <button
        onClick={onNext}
        disabled={status !== 'available'}
        className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
      >
        Continue
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-2 py-2 text-xs text-text3 hover:text-text2 transition-colors"
      >
        Skip for now
      </button>
    </div>
  )
}

function StepNorthStar({ value, onChange, error, loading, onNext, onSkip }) {
  return (
    <div>
      <h1 className="font-serif text-[28px] text-text leading-tight text-center mb-3">
        What are you really working toward?
      </h1>
      <p className="text-sm text-text3 text-center leading-relaxed mb-8 max-w-sm mx-auto">
        Your North Star is the honest motivation behind your goals, not the goal itself. What makes the hard work feel worth it?
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
        disabled={!value.trim()}
        className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
      >
        Save & continue
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="w-full mt-2 py-2 text-xs text-text3 hover:text-text2 transition-colors"
      >
        Skip for now — set it later from my profile
      </button>
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
          { day: 'Mon', color: 'bg-burg', title: 'Set your commitment', desc: "One specific thing you'll do this week. Add a consequence if you miss it." },
          { day: 'Tue–Sat', color: 'bg-burg/70', title: 'Check in daily', desc: "One tap to confirm you did it. Miss a day? Submit an excuse and your group votes." },
          { day: 'Sun', color: 'bg-burg/40', title: 'Reflect', desc: "How did the week go? Your streak and history build over time." },
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

      <button onClick={onNext} className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors">
        Got it
      </button>
    </div>
  )
}

function StepNotifications({ status, onRequest, onSkip, onDone }) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl bg-burg/10 flex items-center justify-center mx-auto mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--burg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      </div>
      <h1 className="font-serif text-[28px] text-text leading-tight mb-3">Never miss a check-in</h1>
      <p className="text-sm text-text3 leading-relaxed mb-8 max-w-sm mx-auto">
        LockIn sends you a daily reminder at 9am, a Sunday goal-setting nudge, and lets your friends nudge you when you go silent.
      </p>

      {status === 'granted' ? (
        <div className="space-y-4">
          <div className="bg-cream2 border border-border rounded-xl p-4 text-sm text-text">Notifications enabled. You're all set.</div>
          <button onClick={onDone} className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors">Start using LockIn</button>
        </div>
      ) : status === 'denied' ? (
        <div className="space-y-4">
          <div className="bg-cream2 border border-border rounded-xl p-4 text-sm text-text2">Notifications blocked. You can enable them later in your browser settings.</div>
          <button onClick={onDone} className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors">Start using LockIn</button>
        </div>
      ) : (
        <div className="space-y-3">
          <button onClick={onRequest} className="w-full py-3.5 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors">Enable notifications</button>
          <button onClick={onSkip} className="w-full py-3.5 text-text3 text-sm hover:text-text2 transition-colors">Maybe later</button>
        </div>
      )}
    </div>
  )
}
