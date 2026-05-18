import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import Logo from './Logo'
import Avatar from './ui/Avatar'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const NAV_LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/groups', label: 'Groups' },
  { to: '/friends', label: 'Friends' },
  { to: '/matches', label: 'Matches' },
  { to: '/challenge', label: 'Challenge' },
]

const DROPDOWN_LINKS = [
  { to: '/north-star', label: 'North Star' },
  { to: '/insights', label: 'AI Insights' },
  { to: '/history', label: 'History' },
  { to: '/profile', label: 'Profile' },
]

export default function TopNav({ pendingVotes = 0, unreadMessages = 0 }) {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isDropdownActive = DROPDOWN_LINKS.some(l => location.pathname === l.to)

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '0 28px',
        height: 58,
        display: 'flex', alignItems: 'center', gap: 32,
      }}>
        {/* Logo */}
        <NavLink to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <Logo size="md" />
        </NavLink>

        {/* Main nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--burg)' : 'var(--text3)',
                  background: isActive ? 'var(--cream2)' : 'transparent',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  {link.label}
                  {link.to === '/friends' && unreadMessages > 0 && (
                    <span style={{
                      background: 'var(--burg)', color: 'white',
                      fontSize: 9, fontWeight: 600,
                      padding: '1px 5px', borderRadius: 10, lineHeight: '14px',
                    }}>{unreadMessages}</span>
                  )}
                </span>
              )}
            </NavLink>
          ))}

          {/* Votes */}
          <NavLink to="/votes" style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--burg)' : 'var(--text3)',
                background: isActive ? 'var(--cream2)' : 'transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
                Votes
                {pendingVotes > 0 && (
                  <span style={{
                    background: 'var(--burg)',
                    color: 'white',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 10,
                    lineHeight: '14px',
                  }}>
                    {pendingVotes}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        </nav>

        {/* Right: More dropdown + Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* More dropdown */}
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isDropdownActive ? 500 : 400,
                color: isDropdownActive ? 'var(--burg)' : 'var(--text3)',
                background: isDropdownActive ? 'var(--cream2)' : 'transparent',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              More
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                minWidth: 160,
                overflow: 'hidden',
                zIndex: 50,
              }}>
                {DROPDOWN_LINKS.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setDropdownOpen(false)}
                    style={{ textDecoration: 'none' }}
                  >
                    {({ isActive }) => (
                      <div style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        color: isActive ? 'var(--burg)' : 'var(--text)',
                        background: isActive ? 'var(--cream2)' : 'transparent',
                        fontWeight: isActive ? 500 : 400,
                        cursor: 'pointer',
                      }}>
                        {link.label}
                      </div>
                    )}
                  </NavLink>
                ))}
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={handleSignOut}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '10px 16px',
                      fontSize: 13,
                      color: 'var(--text3)',
                      background: 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Avatar → profile */}
          <NavLink to="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <Avatar
              userId={profile?.id}
              initials={profile?.avatar_initials}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
          </NavLink>
        </div>
      </div>
    </header>
  )
}
