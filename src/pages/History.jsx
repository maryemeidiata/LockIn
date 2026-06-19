import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import DayTrack from '../components/ui/DayTrack'
import { buildDayStates } from '../lib/weekUtils'
import LoadingPulse from '../components/ui/LoadingPulse'

function formatWeekRange(weekStart) {
  const d = new Date(weekStart + 'T00:00:00')
  const end = new Date(d)
  end.setDate(d.getDate() + 6)
  const fmt = dt => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(d)} – ${fmt(end)}`
}

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
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(107,30,58,0.08)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--burg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div>
          <h1 className="font-serif text-[22px] text-text tracking-tight leading-none mb-0.5">History</h1>
          <p className="text-xs text-text3">
            {totalWeeks > 0 ? `${totalWeeks} week${totalWeeks !== 1 ? 's' : ''} tracked` : 'Your journey starts here'}
          </p>
        </div>
      </div>

      {/* Stats */}
      {totalWeeks > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { num: totalWeeks, label: 'Weeks tracked', d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { num: completedWeeks, label: 'Strong weeks', d: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z' },
            { num: `${avgCompletion}%`, label: 'Avg completion', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-2xl shadow-card p-4 text-center">
              <div className="w-7 h-7 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{background:'rgba(107,30,58,0.08)'}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--burg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.d}/>
                </svg>
              </div>
              <p className="font-serif text-[26px] text-burg leading-none font-light">{s.num}</p>
              <p className="text-[10px] text-text3 mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly list */}
      {weeks.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream2 flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--burg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">No history yet</p>
          <p className="text-xs text-text3 max-w-xs mx-auto">Complete your first week of check-ins and come back to watch your journey unfold.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map(w => {
            const isPerfect = w.completedDays >= 5
            const pct = Math.round((w.completedDays / 7) * 100)
            const barColor = w.completedDays >= 5 ? '#22c55e' : w.completedDays >= 3 ? 'var(--burg)' : 'var(--burg-muted)'
            return (
              <div
                key={w.id}
                className={`border rounded-2xl shadow-card px-5 py-4 relative ${isPerfect ? 'bg-white border-green-200/60' : 'bg-white border-border'}`}
              >
                {isPerfect && (
                  <div className="absolute top-3.5 right-4">
                    <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✦ Perfect</span>
                  </div>
                )}
                <div className="mb-1.5 pr-20">
                  <p className="text-xs font-medium text-text2">{formatWeekRange(w.week_start)}</p>
                  <p className="text-[11px] text-text3">{w.group_name}</p>
                </div>
                <p className="text-sm text-text mb-3">{w.commitment_text}</p>
                <DayTrack states={w.dayStates} />
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-cream2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <span className="text-[10px] text-text3 flex-shrink-0 w-7 text-right">{w.completedDays}/7</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
