import { useState } from 'react'
import { Link } from 'react-router-dom'
import CardTag from './ui/CardTag'
import MemberRow from './MemberRow'

export default function GroupCard({ group }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white border border-border rounded-xl shadow-card p-5 card-interactive">
      <div
        className="flex items-center justify-between pb-3 border-b border-cream2 mb-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <CardTag label={group.name} variant="group" />
        </div>
        <span className="text-xs text-text3">{group.members?.length || 0} members</span>
      </div>

      {group.members?.slice(0, expanded ? undefined : 4).map(member => (
        <MemberRow
          key={member.id}
          member={member}
          dayStates={member.dayStates || []}
        />
      ))}

      <Link
        to={`/groups/${group.id}`}
        className="block mt-3 text-center text-xs text-burg font-medium py-2 rounded-lg hover:bg-cream2 transition-colors border border-transparent hover:border-border"
      >
        View group details
      </Link>
    </div>
  )
}
