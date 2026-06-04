import { weeksSince } from '../lib/weekUtils'

export default function NorthStarBar({ northStar, createdAt }) {
  const weeks = weeksSince(createdAt)
  return (
    <div className="bg-white border border-border rounded-xl shadow-card px-5 py-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--cream2)' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1l1.796 3.638L14 5.528l-3 2.924.708 4.131L8 10.5l-3.708 2.083L5 8.452 2 5.528l4.204-.89L8 1z" fill="var(--burg)" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-widest text-text3 mb-0.5">North Star</p>
        <p className="font-serif italic text-text text-[15px] leading-snug">{northStar || 'Not set yet. Tap to define your why.'}</p>
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
