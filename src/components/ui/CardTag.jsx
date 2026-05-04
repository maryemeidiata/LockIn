const variantStyle = {
  group:      { background: '#F2EAE0', color: '#5C3347' },
  match:      { background: '#F5E6EB', color: '#6B1E3A' },
  vote:       { background: '#6B1E3A', color: '#FAF6F1' },
  ai:         { background: '#F2EAE0', color: '#5C3347' },
  challenge:  { background: '#4A1228', color: '#FAF6F1' },
  pattern:    { background: '#F2EAE0', color: '#5C3347' },
  drift:      { background: '#6B1E3A', color: '#FAF6F1' },
  suggestion: { background: '#E8DDD0', color: '#1A0A10' },
}

export default function CardTag({ label, variant = 'group' }) {
  const style = variantStyle[variant] || variantStyle.group
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      padding: '3px 8px',
      borderRadius: 4,
      ...style,
    }}>
      {label}
    </span>
  )
}
