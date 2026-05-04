import { getWeekOfMonth } from '../../lib/weekUtils'

export default function WeekBadge() {
  const week = getWeekOfMonth()
  return (
    <span className="inline-flex items-center text-xs font-medium text-text2 bg-cream2 border border-border px-3 py-1 rounded-full">
      Week {week} of 4
    </span>
  )
}
