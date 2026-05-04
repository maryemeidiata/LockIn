import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import VoteCard from '../components/VoteCard'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function Votes() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchPending()
  }, [user])

  async function fetchPending() {
    setLoading(true)
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (!myGroups?.length) { setLoading(false); return }

    const groupIds = myGroups.map(g => g.group_id)

    const { data: subs } = await supabase
      .from('missed_submissions')
      .select('*, user:users(*), commitment:commitments(group_id, commitment_text)')
      .neq('user_id', user.id)

    const relevant = (subs || []).filter(s => groupIds.includes(s.commitment?.group_id))

    const { data: myVotes } = await supabase
      .from('votes')
      .select('missed_submission_id')
      .eq('voter_id', user.id)

    const voted = new Set(myVotes?.map(v => v.missed_submission_id) || [])
    setSubmissions(relevant.filter(s => !voted.has(s.id)))
    setLoading(false)
  }

  if (loading) return <LoadingPulse lines={3} />

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="font-serif text-[26px] text-text tracking-tight">Votes pending</h1>
      {submissions.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3">No votes needed right now. When a group member misses their commitment and submits an excuse, it will appear here.</p>
        </div>
      ) : (
        submissions.map(sub => (
          <VoteCard key={sub.id} submission={sub} onVoted={fetchPending} />
        ))
      )}
    </div>
  )
}
