const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function DayTrack({ states = [], showLabels = false }) {
  const stateStyle = {
    done:     { background: 'var(--burg)' },
    excused:  { background: '#A8C4A2' },
    rejected: { background: '#C4857A' },
    today:    { background: 'var(--burg-muted)' },
    missed:   { background: 'var(--cream2)' },
    future:   { background: 'var(--cream2)' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'center' }}>
      {showLabels && (
        <div style={{ display: 'flex', gap: 3 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{ width: 11, textAlign: 'center', fontSize: 8, color: 'var(--text3)', fontWeight: 500, lineHeight: 1 }}>
              {label}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const state = states[i] || 'future'
          return (
            <div
              key={i}
              style={{
                width: 11, height: 11,
                borderRadius: 3,
                flexShrink: 0,
                ...stateStyle[state],
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
