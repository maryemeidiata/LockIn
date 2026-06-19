import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import InsightCard from '../components/InsightCard'
import LoadingPulse from '../components/ui/LoadingPulse'
import { generateWeeklySummary, generateInsight, detectNorthStarDrift } from '../lib/ai'

export default function AIInsights() {
  const { user, profile } = useAuth()
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [noData, setNoData] = useState(false)

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
    setGenerateError('')
    setNoData(false)

    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, week_start, commitment_text, status')
      .eq('user_id', user.id)
      .gte('week_start', fourWeeksAgo.toISOString().split('T')[0])

    if (!commitments?.length) {
      setNoData(true)
      setGenerating(false)
      return
    }

    const { data: checkins } = await supabase
      .from('checkins')
      .select('commitment_id, day_of_week')
      .in('commitment_id', commitments.map(c => c.id))

    const weeklyData = commitments.map(c => ({
      week: c.week_start,
      commitment: c.commitment_text,
      status: c.status,
      checkinDays: checkins?.filter(ci => ci.commitment_id === c.id).map(ci => ci.day_of_week) || [],
    }))

    try {
      const [insightText, summaryText] = await Promise.all([
        generateInsight(weeklyData),
        generateWeeklySummary(weeklyData),
      ])

      const inserts = []
      if (insightText) inserts.push({ user_id: user.id, insight_text: insightText, insight_type: 'pattern' })
      if (summaryText) inserts.push({ user_id: user.id, insight_text: summaryText, insight_type: 'summary' })

      if (profile?.north_star) {
        const commitmentTexts = commitments.map(c => c.commitment_text).filter(Boolean)
        const { driftDetected } = await detectNorthStarDrift(profile.north_star, commitmentTexts)
        if (driftDetected) {
          inserts.push({
            user_id: user.id,
            insight_type: 'drift',
            insight_text: `Some recent commitments may not be aligned with your North Star: "${profile.north_star}". Consider whether your weekly goals still reflect the bigger picture.`,
          })
        }
      }

      if (inserts.length) await supabase.from('ai_insights').insert(inserts)
      await fetchInsights()
    } catch (e) {
      setGenerateError(e.message || 'Something went wrong. Try again.')
    }

    setGenerating(false)
  }

  const summary = insights.find(i => i.insight_type === 'summary')
  const grouped = {
    pattern: insights.filter(i => i.insight_type === 'pattern'),
    drift: insights.filter(i => i.insight_type === 'drift'),
    suggestion: insights.filter(i => i.insight_type === 'suggestion'),
  }
  const hasInsights = grouped.pattern.length + grouped.drift.length + grouped.suggestion.length > 0

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
          {generating ? 'Analyzing...' : 'Generate'}
        </button>
      </div>

      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">{generateError}</div>
      )}

      {noData && (
        <div className="bg-cream2 border border-border rounded-xl p-5 text-sm text-text2">
          No commitment data found in the past 4 weeks. Set a commitment in a group first, then come back here.
        </div>
      )}

      {/* Weekly summary */}
      {summary && (
        <div className="bg-burg/5 border border-burg/20 rounded-xl p-5">
          <p className="text-[10px] font-medium text-burg uppercase tracking-widest mb-2">Weekly summary</p>
          <p className="text-sm text-text leading-relaxed">{summary.insight_text}</p>
          <p className="text-[11px] text-text3 mt-2">
            {new Date(summary.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      )}

      {!hasInsights && !noData && !generating && (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-text3 mb-4">No insights yet. Hit Generate and Stella will analyze your check-in patterns.</p>
          <button
            onClick={generateNow}
            disabled={generating}
            className="px-5 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
          >
            {generating ? 'Analyzing...' : 'Analyze my data'}
          </button>
        </div>
      )}

      {grouped.drift.length > 0 && (
        <section>
          <h2 className="font-serif text-lg text-text mb-3">Drift alerts</h2>
          <div className="space-y-3">
            {grouped.drift.map(i => <InsightCard key={i.id} insight={i} />)}
          </div>
        </section>
      )}

      {grouped.pattern.length > 0 && (
        <section>
          <h2 className="font-serif text-lg text-text mb-3">Patterns</h2>
          <div className="space-y-3">
            {grouped.pattern.map(i => <InsightCard key={i.id} insight={i} />)}
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
    </div>
  )
}
