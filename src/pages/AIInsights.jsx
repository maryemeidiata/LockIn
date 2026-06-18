import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import InsightCard from '../components/InsightCard'
import LoadingPulse from '../components/ui/LoadingPulse'
import { generateWeeklySummary, generateInsight } from '../lib/openai'
import { getCurrentWeekStartStr } from '../lib/weekUtils'

export default function AIInsights() {
  const { user } = useAuth()
  const [insights, setInsights] = useState([])
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (user) fetchInsights()
  }, [user])

  async function fetchInsights() {
    setLoading(true)
    const { data } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setInsights(data || [])
    setLoading(false)
  }

  async function generateNow() {
    setGenerating(true)
    const weekStart = getCurrentWeekStartStr()
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, week_start, commitment_text, status')
      .eq('user_id', user.id)
      .gte('week_start', fourWeeksAgo.toISOString().split('T')[0])

    if (!commitments?.length) { setGenerating(false); return }

    const { data: checkins } = await supabase
      .from('checkins')
      .select('commitment_id, day_of_week, checked_in_at')
      .in('commitment_id', commitments.map(c => c.id))

    const weeklyData = commitments.map(c => ({
      week: c.week_start,
      commitment: c.commitment_text,
      status: c.status,
      checkinDays: checkins.filter(ci => ci.commitment_id === c.id).map(ci => ci.day_of_week),
    }))

    const insightText = await generateInsight(weeklyData)
    if (insightText) {
      await supabase.from('ai_insights').insert({
        user_id: user.id,
        insight_text: insightText,
        insight_type: 'pattern',
      })
      fetchInsights()
    }
    setGenerating(false)
  }

  const grouped = {
    pattern: insights.filter(i => i.insight_type === 'pattern'),
    drift: insights.filter(i => i.insight_type === 'drift'),
    suggestion: insights.filter(i => i.insight_type === 'suggestion'),
  }

  if (loading) return <LoadingPulse lines={4} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[26px] text-text tracking-tight">AI Insights</h1>
        <button
          onClick={generateNow}
          disabled={generating}
          className="px-4 py-2 bg-burg text-cream text-xs font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
        >
          {generating ? 'Analyzing...' : 'Generate insight'}
        </button>
      </div>

      {insights.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3 mb-4">Insights are generated once you have at least three weeks of data. Check back after you have been tracking for a few weeks.</p>
          <button onClick={generateNow} disabled={generating} className="px-4 py-2 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50">
            {generating ? 'Analyzing...' : 'Analyze my data now'}
          </button>
        </div>
      ) : (
        <>
          {grouped.pattern.length > 0 && (
            <section>
              <h2 className="font-serif text-lg text-text mb-3">Patterns</h2>
              <div className="space-y-3">
                {grouped.pattern.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </section>
          )}
          {grouped.drift.length > 0 && (
            <section>
              <h2 className="font-serif text-lg text-text mb-3">Drift alerts</h2>
              <div className="space-y-3">
                {grouped.drift.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </section>
          )}
          {grouped.suggestion.length > 0 && (
            <section>
              <h2 className="font-serif text-lg text-text mb-3">Suggestions</h2>
              <div className="space-y-3">
                {grouped.suggestion.map(i => <InsightCard key={i.id} insight={i} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
