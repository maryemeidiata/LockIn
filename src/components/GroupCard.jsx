import { useState } from 'react'
import { Link } from 'react-router-dom'
import MemberRow from './MemberRow'

export default function GroupCard({ group }) {
  const [expanded, setExpanded] = useState(false)
  const checkedIn = group.members?.filter(m => m.dayStates?.some(s => s === 'done')).length || 0
  const total = group.members?.length || 0

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden card-interactive">
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-cream2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <p className="font-medium text-text">{group.name}</p>
          <p className="text-[11px] text-text3 mt-0.5">{total} members · {checkedIn} checked in today</p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-text3 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      <div className="px-5 pb-1">
        {group.members?.slice(0, expanded ? undefined : 3).map(member => (
          <MemberRow key={member.id} member={member} dayStates={member.dayStates || []} />
        ))}
      </div>

      <div className="px-5 pb-4">
        <Link
          to={`/groups/${group.id}`}
          className="block text-center text-xs text-burg font-medium py-2 rounded-xl hover:bg-cream2 transition-colors border border-transparent hover:border-border"
        >
          View group →
        </Link>
      </div>
    </div>
  )
}
