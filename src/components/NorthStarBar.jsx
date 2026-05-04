import { weeksSince } from '../lib/weekUtils'

export default function NorthStarBar({ northStar, createdAt }) {
  const weeks = weeksSince(createdAt)
  return (
    <div className="bg-white border border-border rounded-xl shadow-card px-5 py-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-widest text-text3 mb-1.5">North Star</p>
        <p className="font-serif italic text-text text-base leading-snug">{northStar || 'Not set yet.'}</p>
      </div>
      {weeks > 0 && (
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-serif text-burg leading-none">{weeks}</p>
          <p className="text-[10px] text-text3 mt-0.5">weeks</p>
        </div>
      )}
    </div>
  )
}
