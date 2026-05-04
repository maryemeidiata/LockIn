import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCurrentWeekStartStr } from '../lib/weekUtils'

export default function CommitmentForm({ groupId, onSaved }) {
  const { user } = useAuth()
  const [commitmentText, setCommitmentText] = useState('')
  const [consequenceText, setConsequenceText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!commitmentText.trim()) errs.commitment = 'What will you do this week?'
    if (!consequenceText.trim()) errs.consequence = 'What happens if you miss?'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    const { error } = await supabase.from('commitments').insert({
      user_id: user.id,
      group_id: groupId,
      week_start: getCurrentWeekStartStr(),
      commitment_text: commitmentText.trim(),
      consequence_text: consequenceText.trim(),
      status: 'active',
    })
    setLoading(false)
    if (error) { setErrors({ submit: error.message }); return }
    onSaved?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5 uppercase tracking-wider">
          This week I will
        </label>
        <textarea
          value={commitmentText}
          onChange={e => setCommitmentText(e.target.value)}
          rows={2}
          placeholder="Run three times before Friday."
          className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text bg-white resize-none focus:outline-none focus:border-burg placeholder-text3"
        />
        {errors.commitment && <p className="text-xs text-burg mt-1">{errors.commitment}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5 uppercase tracking-wider">
          If I miss, I will
        </label>
        <textarea
          value={consequenceText}
          onChange={e => setConsequenceText(e.target.value)}
          rows={2}
          placeholder="Donate $10 to a cause I dislike."
          className="w-full border border-border rounded-xl px-4 py-3 text-sm text-text bg-white resize-none focus:outline-none focus:border-burg placeholder-text3"
        />
        {errors.consequence && <p className="text-xs text-burg mt-1">{errors.consequence}</p>}
      </div>
      {errors.submit && <p className="text-xs text-burg">{errors.submit}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-burg text-cream font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Set my commitment'}
      </button>
    </form>
  )
}
