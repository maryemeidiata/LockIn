import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import VoteCard from '../components/VoteCard'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function Votes() {
  const { user } = useAuth()
  const [pending, setPending] = useState([])
  const [resolved, setResolved] = useState([])
  const [myResolved, setMyResolved] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (!myGroups?.length) { setLoading(false); return }

    const groupIds = myGroups.map(g => g.group_id)

    const { data: subs } = await supabase
      .from('missed_submissions')
      .select('*, user:users(*), commitment:commitments(group_id, commitment_text, consequence_text), votes(is_valid)')

    const relevant = (subs || []).filter(s => groupIds.includes(s.commitment?.group_id))

    const { data: myVotes } = await supabase
      .from('votes')
      .select('missed_submission_id')
      .eq('voter_id', user.id)

    const voted = new Set(myVotes?.map(v => v.missed_submission_id) || [])

    setPending(relevant.filter(s => s.user_id !== user.id && !voted.has(s.id) && s.status === 'pending'))
    setResolved(relevant.filter(s => s.user_id !== user.id && (voted.has(s.id) || s.status !== 'pending')))
    setMyResolved(relevant.filter(s => s.user_id === user.id))

    setLoading(false)
  }

  if (loading) return <LoadingPulse lines={3} />

  return (
    <div className="space-y-5">
      {/* Dark hero header */}
      <div className="rounded-2xl overflow-hidden shadow-card" style={{background:'linear-gradient(135deg, #1A0A10 0%, #3A0F1E 100%)'}}>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h1 className="font-serif text-[22px] text-cream tracking-tight leading-none mb-0.5">Votes</h1>
              <p className="text-[11px] text-cream/50">
                {pending.length > 0
                  ? `${pending.length} verdict${pending.length !== 1 ? 's' : ''} need your input`
                  : 'No pending verdicts'}
              </p>
            </div>
          </div>
          {pending.length > 0 && (
            <div className="w-8 h-8 rounded-full bg-burg border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-cream text-sm font-bold">{pending.length}</span>
            </div>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="space-y-4">
          {pending.map(sub => (
            <VoteCard key={sub.id} submission={sub} onVoted={fetchAll} />
          ))}
        </div>
      )}

      {pending.length === 0 && resolved.length === 0 && myResolved.length === 0 && !loading && (
        <div className="bg-white border border-border rounded-2xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream2 flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--burg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">All clear</p>
          <p className="text-xs text-text3 max-w-xs mx-auto">
            When a group member misses a commitment and submits an excuse, your group votes on whether it's valid. Nothing to judge right now.
          </p>
        </div>
      )}

      {myResolved.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-3">Your submissions</p>
          <div className="space-y-3">
            {myResolved.map(sub => (
              <VerdictCard key={sub.id} submission={sub} isOwn />
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text2 uppercase tracking-wider mb-3">Resolved</p>
          <div className="space-y-3">
            {resolved.map(sub => (
              <VerdictCard key={sub.id} submission={sub} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VerdictCard({ submission, isOwn }) {
  const person = submission.user
  const approved = submission.status === 'approved'
  const isPending = submission.status === 'pending'
  const validCount = (submission.votes || []).filter(v => v.is_valid).length
  const invalidCount = (submission.votes || []).filter(v => !v.is_valid).length

  const accentColor = approved ? '#22c55e' : isPending ? '#f59e0b' : '#ef4444'

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="h-1 w-full" style={{background: accentColor}} />
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-text">{isOwn ? 'Your excuse' : `${person?.name}'s excuse`}</p>
          {!isPending && (
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              approved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {approved ? 'Accepted' : 'Rejected'}
            </span>
          )}
          {isPending && (
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
              Voting in progress
            </span>
          )}
        </div>
        <p className="text-xs text-text3 mb-2 leading-relaxed">{submission.excuse_text}</p>
        {isPending && (
          <p className="text-xs text-text3">
            {validCount + invalidCount} vote{validCount + invalidCount !== 1 ? 's' : ''} cast so far.
          </p>
        )}
        {!isPending && !approved && submission.commitment?.consequence_text && (
          <p className="text-xs text-burg mt-1 font-medium">Consequence: {submission.commitment.consequence_text}</p>
        )}
        {!isPending && (
          <p className="text-xs text-text3 mt-1">{validCount} valid · {invalidCount} not valid</p>
        )}
      </div>
    </div>
  )
}
