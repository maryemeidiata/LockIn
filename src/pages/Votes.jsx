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

    // Pending: not mine, not yet voted on, still open
    setPending(relevant.filter(s => s.user_id !== user.id && !voted.has(s.id) && s.status === 'pending'))

    // Resolved: not mine, already voted on or closed
    setResolved(relevant.filter(s => s.user_id !== user.id && (voted.has(s.id) || s.status !== 'pending')))

    // My own submissions (pending or resolved)
    setMyResolved(relevant.filter(s => s.user_id === user.id))

    setLoading(false)
  }

  if (loading) return <LoadingPulse lines={3} />

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="font-serif text-[26px] text-text tracking-tight">Votes</h1>

      {pending.length > 0 && (
        <div className="space-y-4">
          {pending.map(sub => (
            <VoteCard key={sub.id} submission={sub} onVoted={fetchAll} />
          ))}
        </div>
      )}

      {pending.length === 0 && resolved.length === 0 && myResolved.length === 0 && !loading && (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3">No votes needed right now. When a group member misses their commitment and submits an excuse, it will appear here.</p>
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

  return (
    <div className="bg-white border border-border rounded-xl shadow-card px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-text">{isOwn ? 'Your excuse' : `${person?.name}'s excuse`}</p>
        {!isPending && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
            approved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {approved ? 'Accepted' : 'Rejected'}
          </span>
        )}
        {isPending && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-cream2 text-text3">
            Voting in progress
          </span>
        )}
      </div>
      <p className="text-xs text-text3 mb-2">{submission.excuse_text}</p>
      {isPending && (
        <p className="text-xs text-text3">
          {validCount + invalidCount} vote(s) cast so far. Waiting for the group to finish.
        </p>
      )}
      {!isPending && !approved && submission.commitment?.consequence_text && (
        <p className="text-xs text-burg mt-1">Consequence: {submission.commitment.consequence_text}</p>
      )}
      {!isPending && (
        <p className="text-xs text-text3 mt-1">
          {validCount} valid · {invalidCount} not valid
        </p>
      )}
    </div>
  )
}
