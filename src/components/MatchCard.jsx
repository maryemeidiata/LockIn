import Avatar from './ui/Avatar'

export default function MatchCard({ match }) {
  const other = match.other_user
  return (
    <div className="rounded-2xl overflow-hidden shadow-card" style={{ background: 'linear-gradient(135deg, #3A0F1E 0%, #6B1E3A 100%)' }}>
      <div className="px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-cream/50 mb-3">✦ This week's match</p>
        <div className="flex items-start gap-3 mb-3">
          <Avatar userId={other?.id} initials={other?.avatar_initials} avatarUrl={other?.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-cream">{other?.name}</p>
            {other?.north_star && (
              <p className="text-xs text-cream/60 italic mt-0.5 leading-snug line-clamp-2">{other.north_star}</p>
            )}
            {match.other_commitment && (
              <p className="text-xs text-cream/80 mt-1.5 bg-white/10 px-2.5 py-1 rounded-lg inline-block leading-snug">{match.other_commitment}</p>
            )}
          </div>
        </div>
        {match.match_reason && (
          <p className="text-xs text-cream/70 leading-relaxed border-t border-white/10 pt-3">{match.match_reason}</p>
        )}
      </div>
    </div>
  )
}
