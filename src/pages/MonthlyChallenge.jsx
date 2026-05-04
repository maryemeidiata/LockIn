import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import CardTag from '../components/ui/CardTag'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function MonthlyChallenge() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [joined, setJoined] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    const { data: chs } = await supabase
      .from('challenges')
      .select('*')
      .gte('month_start', monthStart)
      .order('created_at')

    const { data: participations } = await supabase
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', user.id)

    const { data: allParticipants } = await supabase
      .from('challenge_participants')
      .select('challenge_id, user_id')

    const participantCounts = {}
    for (const p of allParticipants || []) {
      participantCounts[p.challenge_id] = (participantCounts[p.challenge_id] || 0) + 1
    }

    setChallenges((chs || []).map(c => ({ ...c, participant_count: participantCounts[c.id] || 0 })))
    setJoined(new Set((participations || []).map(p => p.challenge_id)))
    setLoading(false)
  }

  async function joinChallenge(challengeId) {
    await supabase.from('challenge_participants').insert({
      challenge_id: challengeId,
      user_id: user.id,
    })
    setJoined(prev => new Set([...prev, challengeId]))
  }

  const daysLeft = () => {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return last.getDate() - now.getDate()
  }

  if (loading) return <LoadingPulse lines={4} />

  const myChallenges = challenges.filter(c => joined.has(c.id))
  const open = challenges.filter(c => !joined.has(c.id))

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <h1 className="font-serif text-[26px] text-text tracking-tight">Monthly Challenge</h1>
        <span className="text-xs text-text3 bg-cream2 border border-border px-3 py-1.5 rounded-full">
          {daysLeft()} days left
        </span>
      </div>

      {/* Active challenges */}
      {myChallenges.length > 0 ? (
        <section>
          <h2 className="font-serif text-lg text-text mb-3">Your challenges</h2>
          <div className="space-y-4">
            {myChallenges.map(c => (
              <ChallengeCard key={c.id} challenge={c} joined />
            ))}
          </div>
        </section>
      ) : (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3 mb-4">You have not joined a challenge this month. Challenges connect you with your extended network around a shared goal.</p>
        </div>
      )}

      {/* Open challenges */}
      {open.length > 0 && (
        <section>
          <h2 className="font-serif text-lg text-text mb-3">Open challenges</h2>
          <div className="space-y-4">
            {open.map(c => (
              <ChallengeCard key={c.id} challenge={c} onJoin={() => joinChallenge(c.id)} />
            ))}
          </div>
        </section>
      )}

      {challenges.length === 0 && (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3">No challenges available for this month yet. Check back soon.</p>
        </div>
      )}
    </div>
  )
}

function ChallengeCard({ challenge, joined = false, onJoin }) {
  const progress = Math.min(100, (challenge.participant_count / 20) * 100)
  return (
    <div className="bg-white border border-border rounded-xl shadow-card p-5">
      <div className="flex items-start justify-between mb-2">
        <CardTag label={joined ? 'Joined' : 'Open challenge'} variant="challenge" />
        <span className="text-xs text-text3">{challenge.participant_count} joined</span>
      </div>
      <p className="font-medium text-text mb-1">{challenge.title}</p>
      <p className="text-xs text-text2 mb-4 leading-relaxed">{challenge.description}</p>

      {/* Progress bar */}
      <div className="bg-cream2 rounded-full overflow-hidden h-1.5 mb-1.5">
        <div className="h-full bg-burg rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-text3 mb-4">
        <span>{challenge.participant_count} participants</span>
        <span>{Math.round(progress)}% of goal</span>
      </div>

      {!joined && onJoin && (
        <button
          onClick={onJoin}
          className="w-full py-2.5 bg-burg-deep text-cream text-sm font-medium rounded-[10px] hover:bg-burg transition-colors"
        >
          Join challenge
        </button>
      )}
    </div>
  )
}
