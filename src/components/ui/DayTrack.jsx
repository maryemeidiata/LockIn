const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const stateStyle = {
  done:     { background: 'var(--burg)', boxShadow: '0 0 0 1px rgba(107,30,58,0.25)' },
  excused:  { background: '#A8C4A2' },
  rejected: { background: '#C4857A' },
  today:    { background: 'var(--burg-muted)', opacity: 0.7 },
  missed:   { background: 'var(--cream3)', border: '1px solid var(--border)' },
  future:   { background: 'var(--cream2)' },
}

export default function DayTrack({ states = [], showLabels = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'center' }}>
      {showLabels && (
        <div style={{ display: 'flex', gap: 4 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{ width: 13, textAlign: 'center', fontSize: 9, color: 'var(--text3)', fontWeight: 500, lineHeight: 1 }}>
              {label}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const state = states[i] || 'future'
          return (
            <div
              key={i}
              style={{
                width: 13, height: 13,
                borderRadius: 4,
                flexShrink: 0,
                transition: 'background 0.2s',
                ...stateStyle[state],
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
