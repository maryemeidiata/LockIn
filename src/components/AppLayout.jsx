import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AppLayout() {
  const { user } = useAuth()
  const [pendingVotes, setPendingVotes] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchCounts()
  }, [user])

  async function fetchCounts() {
    const { data: myGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    if (!myGroups?.length) return
    const groupIds = myGroups.map(g => g.group_id)

    const { data: submissions } = await supabase
      .from('missed_submissions')
      .select('id, commitment:commitments(group_id)')
      .neq('user_id', user.id)

    if (!submissions?.length) return

    const myGroupSubmissions = submissions.filter(s =>
      groupIds.includes(s.commitment?.group_id)
    )

    const { data: myVotes } = await supabase
      .from('votes')
      .select('missed_submission_id')
      .eq('voter_id', user.id)

    const voted = new Set(myVotes?.map(v => v.missed_submission_id) || [])
    const pending = myGroupSubmissions.filter(s => !voted.has(s.id))
    setPendingVotes(pending.length)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Desktop top nav */}
      <div className="hidden md:block">
        <TopNav pendingVotes={pendingVotes} />
      </div>

      {/* Main content */}
      <main className="pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8 page-fade">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
