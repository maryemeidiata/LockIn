import CardTag from './ui/CardTag'

export default function InsightCard({ insight }) {
  const date = new Date(insight.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
  return (
    <div className="bg-white border border-border rounded-xl shadow-card px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <CardTag label={insight.insight_type} variant={insight.insight_type} />
        <span className="text-xs text-text3">{date}</span>
      </div>
      <p className="text-sm text-text leading-relaxed">{insight.insight_text}</p>
    </div>
  )
}
