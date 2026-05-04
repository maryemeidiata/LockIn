import Avatar from './ui/Avatar'
import CardTag from './ui/CardTag'

export default function MatchCard({ match, onCheckIn }) {
  const other = match.other_user
  return (
    <div className="bg-white border border-border rounded-xl shadow-card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <CardTag label="This week's match" variant="match" />
      </div>
      <div className="flex items-start gap-3 mb-3">
        <Avatar userId={other?.id} initials={other?.avatar_initials} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text">{other?.name}</p>
          {other?.north_star && (
            <p className="text-xs text-text3 italic mt-0.5 leading-snug truncate">{other.north_star}</p>
          )}
          {match.other_commitment && (
            <p className="text-xs text-text2 mt-1 leading-snug">{match.other_commitment}</p>
          )}
        </div>
      </div>
      {match.match_reason && (
        <p className="text-xs text-text2 bg-cream px-3 py-2 rounded-lg mb-3 leading-relaxed border border-border">
          {match.match_reason}
        </p>
      )}
      <button
        onClick={onCheckIn}
        className="w-full py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
      >
        Check in with {other?.name?.split(' ')[0]}
      </button>
    </div>
  )
}
