import { weeksSince } from '../lib/weekUtils'
import { Link } from 'react-router-dom'

export default function NorthStarBar({ northStar, createdAt, sidebar = false }) {
  const weeks = weeksSince(createdAt)

  if (sidebar) {
    return (
      <Link to="/north-star" className="block no-underline">
        <div className="north-star-card border border-border rounded-2xl shadow-card-md p-6 card-interactive cursor-pointer">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-burg/10 flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1l1.796 3.638L14 5.528l-3 2.924.708 4.131L8 10.5l-3.708 2.083L5 8.452 2 5.528l4.204-.89L8 1z" fill="var(--burg)" />
              </svg>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-burg/70">North Star</p>
          </div>
          <p className="font-serif italic text-text text-[18px] leading-snug mb-4">
            {northStar || 'Tap to define your why.'}
          </p>
          {weeks > 0 && (
            <div className="flex items-baseline gap-1.5 border-t border-border/60 pt-3 mt-1">
              <span className="text-3xl font-serif text-burg leading-none">{weeks}</span>
              <span className="text-xs text-text3">weeks in</span>
            </div>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link to="/north-star" className="block no-underline">
      <div className="north-star-card border border-border rounded-xl shadow-card px-5 py-4 flex items-center gap-4 card-interactive cursor-pointer">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-burg/10">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1l1.796 3.638L14 5.528l-3 2.924.708 4.131L8 10.5l-3.708 2.083L5 8.452 2 5.528l4.204-.89L8 1z" fill="var(--burg)" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-burg/70 mb-0.5">North Star</p>
          <p className="font-serif italic text-text text-[15px] leading-snug">{northStar || 'Not set yet. Tap to define your why.'}</p>
        </div>
        {weeks > 0 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-2xl font-serif text-burg leading-none">{weeks}</p>
            <p className="text-[10px] text-text3 mt-0.5">weeks</p>
          </div>
        )}
      </div>
    </Link>
  )
}
