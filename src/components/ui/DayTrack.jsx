export default function DayTrack({ states = [] }) {
  const stateStyle = {
    done:     { background: 'var(--burg)' },
    excused:  { background: '#A8C4A2' },   // muted green — missed but approved
    rejected: { background: '#C4857A' },   // muted red — missed and consequence applies
    today:    { background: 'var(--burg-muted)' },
    missed:   { background: 'var(--cream2)' },
    future:   { background: 'var(--cream2)' },
  }

  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const state = states[i] || 'future'
        return (
          <div
            key={i}
            style={{
              width: 9, height: 9,
              borderRadius: 2,
              flexShrink: 0,
              ...stateStyle[state],
            }}
          />
        )
      })}
    </div>
  )
}
