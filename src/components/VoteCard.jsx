import { useState } from 'react'
import Avatar from './ui/Avatar'
import CardTag from './ui/CardTag'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function VoteCard({ submission, onVoted }) {
  const { user } = useAuth()
  const [voted, setVoted] = useState(false)
  const [verdict, setVerdict] = useState(null) // 'approved' | 'rejected' | null
  const [loading, setLoading] = useState(false)

  async function handleVote(isValid) {
    setLoading(true)

    await supabase.from('votes').insert({
      missed_submission_id: submission.id,
      voter_id: user.id,
      is_valid: isValid,
    })

    // Tally all votes so far
    const { data: allVotes } = await supabase
      .from('votes')
      .select('is_valid')
      .eq('missed_submission_id', submission.id)

    const validCount = (allVotes || []).filter(v => v.is_valid).length
    const invalidCount = (allVotes || []).filter(v => !v.is_valid).length
    const total = allVotes?.length || 0

    // Get group size (to know how many voters are eligible — all members except the person who missed)
    const { data: commitment } = await supabase
      .from('commitments')
      .select('group_id')
      .eq('id', submission.commitment_id)
      .single()

    let groupSize = 0
    if (commitment) {
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', commitment.group_id)
      groupSize = count || 0
    }

    const eligibleVoters = Math.max(groupSize - 1, 1) // everyone except the person who missed
    const majority = Math.ceil(eligibleVoters / 2)
    const allVoted = total >= eligibleVoters

    let newStatus = null
    if (validCount >= majority || (allVoted && validCount > invalidCount)) {
      newStatus = 'approved'
    } else if (invalidCount >= majority || (allVoted && invalidCount > validCount)) {
      newStatus = 'rejected'
    } else if (allVoted) {
      newStatus = 'approved' // tie goes to the person
    }

    if (newStatus) {
      await supabase
        .from('missed_submissions')
        .update({ status: newStatus, valid_votes: validCount, invalid_votes: invalidCount })
        .eq('id', submission.id)
      setVerdict(newStatus)
    }

    setVoted(true)
    setLoading(false)
    onVoted?.()
  }

  const person = submission.user

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <CardTag label="Vote needed" variant="vote" />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <Avatar userId={person?.id} initials={person?.avatar_initials} size="md" />
        <div>
          <p className="font-medium text-text text-sm">{person?.name}</p>
          <p className="text-xs text-text3">missed their commitment</p>
        </div>
      </div>
      <div className="bg-cream px-3 py-2 rounded-lg mb-4 border border-border">
        <p className="text-xs font-medium text-text3 mb-1 uppercase tracking-wider">Their excuse</p>
        <p className="text-sm text-text leading-relaxed">{submission.excuse_text}</p>
      </div>

      {voted ? (
        verdict ? (
          <div className={`text-center py-3 rounded-xl text-sm font-medium ${
            verdict === 'approved'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {verdict === 'approved'
              ? 'Verdict: excuse accepted. No consequence.'
              : 'Verdict: not accepted. Consequence applies.'}
          </div>
        ) : (
          <div className="text-center py-2 text-sm text-text3">
            Your vote has been recorded. Waiting for others to vote.
          </div>
        )
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => handleVote(true)}
            disabled={loading}
            className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
          >
            Valid excuse
          </button>
          <button
            onClick={() => handleVote(false)}
            disabled={loading}
            className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] hover:bg-cream3 transition-colors disabled:opacity-50 border border-border"
          >
            Not valid
          </button>
        </div>
      )}
    </div>
  )
}
