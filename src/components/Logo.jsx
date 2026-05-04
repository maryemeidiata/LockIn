const MARK_SIZES = { sm: 24, md: 28, lg: 32 }
const TEXT_SIZES = { sm: 'text-base', md: 'text-[18px]', lg: 'text-[22px]' }

export default function Logo({ size = 'md', onDark = false }) {
  const mark = MARK_SIZES[size] || MARK_SIZES.md
  return (
    <div className="flex items-center gap-2">
      <div className="logo-mark-animate">
        <div
          style={{
            width: mark, height: mark,
            background: 'var(--burg)',
            borderRadius: Math.round(mark * 0.25),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width={mark * 0.65} height={mark * 0.65} viewBox="0 0 22 22" fill="none">
            <rect x="3" y="10" width="16" height="11" rx="3" fill="white" />
            <path d="M7.5 10V7C7.5 4.8 9.1 3 11 3C12.9 3 14.5 4.8 14.5 7V10" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            <rect x="9.5" y="13.5" width="3" height="3" rx="1.5" fill="#6B1E3A" />
          </svg>
        </div>
      </div>

      <span className={`font-serif ${TEXT_SIZES[size]} leading-none tracking-tight select-none`}>
        <span style={{ color: onDark ? 'var(--cream)' : 'var(--text)' }}>Lock</span>
        <span style={{ color: 'var(--burg-muted)' }}>In</span>
      </span>
    </div>
  )
}
