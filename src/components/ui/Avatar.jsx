const PALETTE = [
  'bg-[#6B1E3A] text-[#FAF6F1]',
  'bg-[#8B2A4E] text-[#FAF6F1]',
  'bg-[#C4738A] text-[#1A0A10]',
  'bg-[#E8DDD0] text-[#5C3347]',
  'bg-[#4A1228] text-[#FAF6F1]',
  'bg-[#9A6B7A] text-[#FAF6F1]',
]

function colorFromId(id = '') {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export default function Avatar({ userId, initials, avatarUrl, size = 'md' }) {
  const sizeMap = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }
  const color = colorFromId(userId)
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={initials}
        className={`${sizeMap[size]} rounded-full object-cover flex-shrink-0 border border-border`}
      />
    )
  }
  return (
    <div className={`${sizeMap[size]} ${color} rounded-full flex items-center justify-center font-medium flex-shrink-0`}>
      {(initials || '??').toUpperCase()}
    </div>
  )
}
