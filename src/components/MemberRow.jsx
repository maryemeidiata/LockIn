import Avatar from './ui/Avatar'
import DayTrack from './ui/DayTrack'

export default function MemberRow({ member, dayStates = [] }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar userId={member.id} initials={member.avatar_initials} avatarUrl={member.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{member.name}</p>
        <p className="text-xs text-text3 break-words">{member.commitment_text || 'No commitment set'}</p>
      </div>
      <DayTrack states={dayStates} />
    </div>
  )
}
