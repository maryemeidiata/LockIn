import CardTag from './ui/CardTag'

const typeAccent = {
  pattern: '#6B1E3A',
  drift: '#4A1228',
  suggestion: '#8B2A4E',
  summary: '#6B1E3A',
}

export default function InsightCard({ insight }) {
  const date = new Date(insight.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const accent = typeAccent[insight.insight_type] || typeAccent.pattern

  return (
    <div
      className="bg-white border border-border rounded-2xl shadow-card px-5 py-4"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <CardTag label={insight.insight_type} variant={insight.insight_type} />
        <span className="text-[11px] text-text3">{date}</span>
      </div>
      <p className="text-sm text-text leading-relaxed">{insight.insight_text}</p>
    </div>
  )
}
