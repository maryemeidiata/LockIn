import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import DayTrack from '../components/ui/DayTrack'
import { buildDayStates } from '../lib/weekUtils'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function History() {
  const { user } = useAuth()
  const [weeks, setWeeks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchHistory()
  }, [user])

  async function fetchHistory() {
    setLoading(true)
    const { data: commitments } = await supabase
      .from('commitments')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })

    if (!commitments?.length) { setLoading(false); return }

    const { data: checkins } = await supabase
      .from('checkins')
      .select('commitment_id, day_of_week')
      .in('commitment_id', commitments.map(c => c.id))

    const { data: groups } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', [...new Set(commitments.map(c => c.group_id))])

    const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g.name]))

    const enriched = commitments.map(c => {
      const days = (checkins || [])
        .filter(ci => ci.commitment_id === c.id)
        .map(ci => ci.day_of_week)
      const completed = days.length
      return {
        ...c,
        group_name: groupMap[c.group_id] || 'Unknown group',
        dayStates: buildDayStates(days, c.week_start),
        completedDays: completed,
      }
    })

    setWeeks(enriched)
    setLoading(false)
  }

  const totalWeeks = weeks.length
  const completedWeeks = weeks.filter(w => w.completedDays >= 5).length
  const avgCompletion = totalWeeks
    ? Math.round((weeks.reduce((s, w) => s + w.completedDays, 0) / (totalWeeks * 7)) * 100)
    : 0

  if (loading) return <LoadingPulse lines={5} />

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[26px] text-text tracking-tight">History</h1>

      {/* Stats */}
      {totalWeeks > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { num: totalWeeks, label: 'Weeks tracked' },
            { num: completedWeeks, label: 'Strong weeks' },
            { num: `${avgCompletion}%`, label: 'Avg completion' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl shadow-card p-4 text-center">
              <p className="font-serif text-[28px] text-burg leading-none font-light">{s.num}</p>
              <p className="text-[10px] text-text3 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly list */}
      {weeks.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3">No history yet. Come back once you have completed your first week of check-ins.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {weeks.map(w => (
            <div key={w.id} className="bg-white border border-border rounded-xl shadow-card px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-medium text-text2 uppercase tracking-wider">{w.week_start}</p>
                  <p className="text-xs text-text3">{w.group_name}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  w.status === 'completed' ? 'bg-[#D8F0E4] text-[#2D6A4F]' :
                  w.status === 'missed' ? 'bg-cream2 text-burg' :
                  'bg-cream2 text-text2'
                }`}>
                  {w.status}
                </span>
              </div>
              <p className="text-sm text-text mb-2">{w.commitment_text}</p>
              <DayTrack states={w.dayStates} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
