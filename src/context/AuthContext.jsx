import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        fetchProfile(session.user.id)
        applyPendingInvitations(session.user)
      } else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function applyPendingInvitations(authUser) {
    const email = authUser.email?.toLowerCase().trim()
    if (!email) return
    const { data: pending } = await supabase
      .from('invitations')
      .select('id, group_id')
      .eq('invited_email', email)
      .eq('status', 'pending')
    if (!pending?.length) return
    for (const inv of pending) {
      await supabase.from('group_members').upsert(
        { group_id: inv.group_id, user_id: authUser.id },
        { onConflict: 'group_id,user_id', ignoreDuplicates: true }
      )
      await supabase.from('invitations').update({ status: 'accepted' }).eq('id', inv.id)
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
