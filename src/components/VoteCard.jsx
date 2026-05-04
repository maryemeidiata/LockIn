import { useState } from 'react'
import Avatar from './ui/Avatar'
import CardTag from './ui/CardTag'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function VoteCard({ submission, onVoted }) {
  const { user } = useAuth()
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleVote(isValid) {
    setLoading(true)
    await supabase.from('votes').insert({
      missed_submission_id: submission.id,
      voter_id: user.id,
      is_valid: isValid,
    })
    setVoted(true)
    setLoading(false)
    onVoted?.()
  }

  const person = submission.user
  return (
    <div className="bg-white border border-border rounded-xl shadow-card px-5 py-4">
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
        <div className="text-center py-2 text-sm text-text3">
          Your vote has been recorded anonymously.
        </div>
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
