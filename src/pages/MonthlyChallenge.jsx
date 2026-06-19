import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/ui/Avatar'
import LoadingPulse from '../components/ui/LoadingPulse'

const CHALLENGES = [
  { title: '30-Day Walking Challenge', description: 'Walk at least 8,000 steps every day this month. Any pace, any terrain.', category: 'Cardio' },
  { title: 'Daily Plank', description: 'Hold a plank for at least 1 minute every day. Add 5 seconds each week if you can.', category: 'Strength' },
  { title: 'No Added Sugar', description: 'Cut out added sugar for the entire month. Fruit is fine, dessert is not.', category: 'Nutrition' },
  { title: 'Run 50km This Month', description: 'Log at least 50km of running over the month. Pace and route don\'t matter.', category: 'Cardio' },
  { title: 'Morning Stretch Routine', description: 'Do a 10-minute stretch every morning before checking your phone.', category: 'Flexibility' },
  { title: '100 Push-ups a Day', description: 'Complete 100 push-ups every day. Break them into sets however you like.', category: 'Strength' },
  { title: '10 Minutes of Mindfulness', description: 'Meditate, breathe deeply, or journal for at least 10 minutes every day.', category: 'Mindfulness' },
  { title: 'Hydration Challenge', description: 'Drink at least 2.5L of water every single day. Coffee doesn\'t count.', category: 'Wellness' },
  { title: 'Sleep Before Midnight', description: 'Be in bed and off screens by midnight every night this month.', category: 'Recovery' },
  { title: 'Weekly Long Run', description: 'Complete at least one run of 10km+ every week this month. Four total.', category: 'Cardio' },
  { title: 'Bodyweight HIIT', description: '20 minutes of bodyweight HIIT, at least 5 days a week.', category: 'Strength' },
  { title: 'Daily Yoga', description: 'Practice yoga for at least 20 minutes each day. Any style counts.', category: 'Flexibility' },
  { title: 'Cold Shower Challenge', description: 'End every shower with at least 30 seconds of cold water.', category: 'Recovery' },
  { title: 'Swim 10km This Month', description: 'Log at least 10km in the pool or open water over the month.', category: 'Cardio' },
  { title: 'No Takeout Month', description: 'Cook every meal at home. One social exception per week is allowed.', category: 'Nutrition' },
  { title: '10,000 Steps a Day', description: 'Hit 10,000 steps every single day. Walking counts. Pacing your room counts.', category: 'Cardio' },
  { title: 'Full-Body Circuit Daily', description: 'Complete a circuit of squats, push-ups, rows, and lunges every day.', category: 'Strength' },
  { title: 'Digital Detox Evening', description: 'No screens after 9pm every night. Read, walk, or talk instead.', category: 'Mindfulness' },
  { title: 'Bike 100km This Month', description: 'Cycle at least 100km total this month. Commutes count.', category: 'Cardio' },
  { title: 'Protein-First Eating', description: 'Start every meal with your protein before anything else on the plate.', category: 'Nutrition' },
  { title: 'Stretch Before Bed', description: 'Do a 10-minute stretching routine every night before sleep.', category: 'Recovery' },
  { title: 'Jump Rope Daily', description: '5 minutes of jump rope every day. Great warm-up, brutal cardio.', category: 'Cardio' },
  { title: 'Gratitude Journaling', description: 'Write 3 things you\'re grateful for and one intention every morning.', category: 'Mindfulness' },
  { title: 'No Alcohol Month', description: 'Skip the drink for the full month. Sparkling water at parties still counts as fun.', category: 'Wellness' },
]

function getAutoChallenge() {
  const now = new Date()
  const idx = (now.getFullYear() * 12 + now.getMonth()) % CHALLENGES.length
  return CHALLENGES[idx]
}

function getMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function getMonthLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function daysLeft() {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return last.getDate() - now.getDate()
}

export default function MonthlyChallenge() {
  const { user, profile } = useAuth()
  const [challenge, setChallenge] = useState(null)
  const [participants, setParticipants] = useState([])
  const [joined, setJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    const monthKey = getMonthKey()

    let { data: ch } = await supabase
      .from('challenges')
      .select('*')
      .eq('month_start', monthKey)
      .maybeSingle()

    if (!ch) {
      const auto = getAutoChallenge()
      const { data: created } = await supabase
        .from('challenges')
        .insert({ title: auto.title, description: auto.description, category: auto.category, month_start: monthKey })
        .select()
        .single()
      ch = created
    }

    setChallenge(ch)
    if (!ch) { setLoading(false); return }

    const { data: parts } = await supabase
      .from('challenge_participants')
      .select('user_id, joined_at, users(id, name, avatar_initials, avatar_url)')
      .eq('challenge_id', ch.id)
      .order('joined_at', { ascending: true })

    setParticipants(parts || [])
    setJoined((parts || []).some(p => p.user_id === user.id))
    setLoading(false)
  }

  async function handleJoin() {
    if (!challenge || joined || joining) return
    setJoining(true)
    await supabase.from('challenge_participants').insert({ challenge_id: challenge.id, user_id: user.id })
    setJoined(true)
    setParticipants(prev => [...prev, {
      user_id: user.id,
      joined_at: new Date().toISOString(),
      users: { id: user.id, name: profile?.name, avatar_initials: profile?.avatar_initials, avatar_url: profile?.avatar_url },
    }])
    setJoining(false)
  }

  async function overrideChallenge(pick) {
    if (!challenge) return
    await supabase.from('challenges')
      .update({ title: pick.title, description: pick.description, category: pick.category })
      .eq('id', challenge.id)
    setShowPicker(false)
    fetchAll()
  }

  if (loading) return <LoadingPulse lines={4} />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-[26px] text-text tracking-tight">Monthly Challenge</h1>
          <p className="text-xs text-text3 mt-0.5">{daysLeft()} days left · {getMonthLabel()}</p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="text-xs text-text3 hover:text-burg transition-colors mt-1"
        >
          Change
        </button>
      </div>

      {challenge && (
        <>
          {/* Challenge hero card */}
          <div className="rounded-2xl p-6 shadow-card-md relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4A1228 0%, #6B1E3A 100%)' }}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, white, transparent)', transform: 'translate(30%, -30%)' }} />
            <span className="text-[10px] font-medium uppercase tracking-widest text-cream/60 mb-3 block">{challenge.category}</span>
            <h2 className="font-serif text-[26px] text-cream leading-tight mb-3">{challenge.title}</h2>
            <p className="text-sm text-cream/75 leading-relaxed mb-6">{challenge.description}</p>

            {joined ? (
              <div className="flex items-center gap-2 text-cream text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                You're in — {participants.length} {participants.length === 1 ? 'person' : 'people'} total
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="px-5 py-2.5 bg-cream text-burg-deep text-sm font-semibold rounded-[10px] hover:bg-cream2 transition-colors disabled:opacity-50"
              >
                {joining ? 'Joining...' : 'Join challenge'}
              </button>
            )}
          </div>

          {/* Participant list */}
          <section>
            <h2 className="font-serif text-lg text-text mb-3">
              Who's in
              {participants.length > 0 && (
                <span className="ml-2 text-sm font-sans font-normal text-text3">{participants.length} {participants.length === 1 ? 'person' : 'people'}</span>
              )}
            </h2>

            {participants.length === 0 ? (
              <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
                <p className="text-sm text-text3">No one has joined yet. Be the first.</p>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-xl shadow-card overflow-hidden">
                {participants.map((p, i) => (
                  <div key={p.user_id} className="flex items-center gap-3 px-5 py-3 border-b border-cream2 last:border-0">
                    <span className="text-xs text-text3 w-5 text-center flex-shrink-0">{i + 1}</span>
                    <Avatar userId={p.users?.id} initials={p.users?.avatar_initials} avatarUrl={p.users?.avatar_url} size="sm" />
                    <p className="text-sm font-medium text-text flex-1">
                      {p.user_id === user.id ? 'You' : (p.users?.name || 'Someone')}
                    </p>
                    <span className="text-[11px] text-text3">
                      {new Date(p.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Challenge picker modal */}
      {showPicker && (
        <div
          className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-cream2 flex-shrink-0">
              <h2 className="font-serif text-xl text-text">Pick a challenge</h2>
              <p className="text-xs text-text3 mt-0.5">Replaces this month's challenge for everyone.</p>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {CHALLENGES.map((c, i) => (
                <button
                  key={i}
                  onClick={() => overrideChallenge(c)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    challenge?.title === c.title ? 'border-burg bg-cream2' : 'border-border hover:bg-cream2'
                  }`}
                >
                  <span className="text-[10px] text-burg uppercase tracking-wider font-medium">{c.category}</span>
                  <p className="text-sm font-medium text-text">{c.title}</p>
                  <p className="text-xs text-text3 mt-0.5 leading-relaxed">{c.description}</p>
                </button>
              ))}
            </div>

            <div className="px-5 pb-6 pt-3 flex-shrink-0">
              <button
                onClick={() => setShowPicker(false)}
                className="w-full py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
