import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AppLayout() {
  const { user, profile } = useAuth()
  const [pendingVotes, setPendingVotes] = useState(0)
  const [groupCount, setGroupCount] = useState(0)

  useEffect(() => {
    if (!user) return
    fetchCounts()
  }, [user])

  async function fetchCounts() {
    // Group count
    const { count: gc } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setGroupCount(gc || 0)

    // Pending votes: missed submissions in groups I'm in, that I haven't voted on yet
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
    <div className="flex min-h-screen bg-cream">
      {/* Desktop sidebar */}
      <div className="hidden md:block w-[220px] flex-shrink-0">
        <Sidebar pendingVotes={pendingVotes} groupCount={groupCount} />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:ml-0 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 page-fade">
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
