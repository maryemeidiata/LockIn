import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getDayIndex } from '../lib/weekUtils'

export default function CheckInButton({ commitmentId, alreadyCheckedIn, onCheckIn }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(alreadyCheckedIn)

  async function handleCheckIn() {
    if (done || loading) return
    setLoading(true)
    const { error } = await supabase.from('checkins').insert({
      commitment_id: commitmentId,
      user_id: user.id,
      day_of_week: getDayIndex(),
    })
    setLoading(false)
    if (!error) {
      setDone(true)
      onCheckIn?.()
    }
  }

  if (done) {
    return (
      <div className="w-full min-h-[52px] flex items-center justify-center bg-cream2 border border-border rounded-[10px]">
        <span className="text-sm font-medium text-text2">Checked in for today</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={loading}
      className="w-full min-h-[52px] bg-burg text-cream text-base font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-60"
    >
      {loading ? 'Checking in...' : 'Check in for today'}
    </button>
  )
}
