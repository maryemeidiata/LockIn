import { NavLink, useNavigate } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import Avatar from './ui/Avatar'

const NAV_MAIN = [
  { to: '/', label: 'Overview' },
  { to: '/groups', label: 'My groups' },
  { to: '/matches', label: 'Matches' },
  { to: '/challenge', label: 'Monthly challenge' },
]

const NAV_PERSONAL = [
  { to: '/north-star', label: 'North star' },
  { to: '/insights', label: 'AI insights' },
  { to: '/history', label: 'History' },
]

export default function Sidebar({ pendingVotes = 0, groupCount = 0 }) {
  const { profile, user } = useAuth()
  const navigate = useNavigate()

  return (
    <div
      style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--burg-deep)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <Logo size="md" onDark />
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 0', flex: 1 }}>
        <SectionLabel>Main</SectionLabel>
        {NAV_MAIN.map(item => (
          <SidebarLink key={item.to} to={item.to} label={item.label} />
        ))}

        <SectionLabel style={{ marginTop: 8 }}>Personal</SectionLabel>
        {NAV_PERSONAL.map(item => (
          <SidebarLink key={item.to} to={item.to} label={item.label} />
        ))}

        <SectionLabel style={{ marginTop: 8 }}>Actions</SectionLabel>
        <NavLink
          to="/votes"
          style={({ isActive }) => navStyle(isActive)}
        >
          <NavDot active={false} />
          Votes pending
          {pendingVotes > 0 && (
            <span style={{
              marginLeft: 'auto',
              background: 'var(--burg)',
              color: 'var(--cream)',
              fontSize: 9,
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: 10,
            }}>
              {pendingVotes}
            </span>
          )}
        </NavLink>
        <NavLink to="/groups?invite=1" style={({ isActive }) => navStyle(isActive)}>
          <NavDot active={false} />
          Invite friends
        </NavLink>
      </nav>

      {/* User */}
      <NavLink
        to="/profile"
        style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', cursor: 'pointer' }}
        className="hover:bg-white/5 transition-colors"
      >
        <Avatar userId={profile?.id} initials={profile?.avatar_initials} avatarUrl={profile?.avatar_url} size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--cream)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile?.name || 'You'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {groupCount} active group{groupCount !== 1 ? 's' : ''}
          </div>
        </div>
      </NavLink>
    </div>
  )
}

function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 500,
      color: 'rgba(255,255,255,0.25)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      padding: '8px 20px 6px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function NavDot({ active }) {
  return (
    <div style={{
      width: 5, height: 5, borderRadius: '50%',
      background: active ? 'var(--burg-muted)' : 'currentColor',
      flexShrink: 0, opacity: active ? 1 : 0.6,
    }} />
  )
}

function navStyle(isActive) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 20px',
    fontSize: 13,
    color: isActive ? 'var(--cream)' : 'rgba(255,255,255,0.45)',
    textDecoration: 'none',
    background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
    borderLeft: `2px solid ${isActive ? 'var(--burg-muted)' : 'transparent'}`,
    transition: 'all 0.15s',
  }
}

function SidebarLink({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => navStyle(isActive)}
    >
      {({ isActive }) => (
        <>
          <NavDot active={isActive} />
          {label}
        </>
      )}
    </NavLink>
  )
}
