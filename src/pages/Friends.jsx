import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getCurrentWeekStartStr, buildDayStates, getDayIndexFromTimestamp } from '../lib/weekUtils'
import Avatar from '../components/ui/Avatar'
import DayTrack from '../components/ui/DayTrack'
import LoadingPulse from '../components/ui/LoadingPulse'

export default function Friends() {
  const { user } = useAuth()
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addTarget, setAddTarget] = useState(null) // person to add to group
  const [myGroups, setMyGroups] = useState([])
  const [addingToGroup, setAddingToGroup] = useState(null)
  const [addSuccess, setAddSuccess] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (user) {
      fetchFriends()
      fetchUnreadCounts()
    }
  }, [user])

  // Real-time subscription for incoming messages
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_user_id=eq.${user.id}`,
      }, payload => {
        const msg = payload.new
        // If this thread is open, add to messages + mark read
        if (activeThread?.id === msg.from_user_id) {
          setMessages(prev => [...prev, msg])
          markRead(msg.from_user_id)
        } else {
          // Update unread badge
          setUnreadCounts(prev => ({
            ...prev,
            [msg.from_user_id]: (prev[msg.from_user_id] || 0) + 1,
          }))
        }
        scrollToBottom()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, activeThread])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load thread when activeThread changes
  useEffect(() => {
    if (activeThread) {
      loadThread(activeThread.id)
      inputRef.current?.focus()
    }
  }, [activeThread])

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function fetchFriends() {
    setLoading(true)
    const weekStart = getCurrentWeekStartStr()

    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id)

    if (!memberships?.length) { setLoading(false); return }

    const groupIds = memberships.map(m => m.group_id)

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('user_id, group_id, users(id, name, avatar_url, avatar_initials)')
      .in('group_id', groupIds)
      .neq('user_id', user.id)

    if (!allMembers?.length) { setLoading(false); return }

    const friendMap = {}
    for (const m of allMembers) {
      const u = m.users
      if (!u) continue
      const group = memberships.find(g => g.group_id === m.group_id)?.groups
      if (!friendMap[u.id]) {
        friendMap[u.id] = { ...u, groups: [], dayStates: Array(7).fill('empty'), commitment_text: '' }
      }
      if (group) friendMap[u.id].groups.push(group.name)
    }

    // Commitments + checkins
    const friendIds = Object.keys(friendMap)
    const { data: commitments } = await supabase
      .from('commitments')
      .select('id, user_id, commitment_text')
      .in('user_id', friendIds)
      .in('group_id', groupIds)
      .eq('week_start', weekStart)

    const commitmentIds = commitments?.map(c => c.id) || []
    let checkins = [], excuses = []
    if (commitmentIds.length) {
      const { data: ci } = await supabase.from('checkins').select('commitment_id, user_id, day_of_week').in('commitment_id', commitmentIds)
      const { data: ex } = await supabase.from('missed_submissions').select('user_id, submitted_at, status').in('commitment_id', commitmentIds).in('status', ['approved', 'rejected'])
      checkins = ci || []
      excuses = ex || []
    }

    for (const fid of friendIds) {
      const commitment = commitments?.find(c => c.user_id === fid)
      if (commitment) {
        friendMap[fid].commitment_text = commitment.commitment_text
        const userCheckins = checkins.filter(ci => ci.user_id === fid).map(ci => ci.day_of_week)
        const approved = excuses.filter(e => e.user_id === fid && e.status === 'approved').map(e => getDayIndexFromTimestamp(e.submitted_at))
        const rejected = excuses.filter(e => e.user_id === fid && e.status === 'rejected').map(e => getDayIndexFromTimestamp(e.submitted_at))
        friendMap[fid].dayStates = buildDayStates(userCheckins, weekStart, approved, rejected)
      }
    }

    setFriends(Object.values(friendMap))
    setLoading(false)
  }

  async function fetchUnreadCounts() {
    const { data } = await supabase
      .from('messages')
      .select('from_user_id')
      .eq('to_user_id', user.id)
      .eq('read', false)

    const counts = {}
    for (const m of data || []) {
      counts[m.from_user_id] = (counts[m.from_user_id] || 0) + 1
    }
    setUnreadCounts(counts)
  }

  async function fetchMyGroups() {
    const { data } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name)')
      .eq('user_id', user.id)
    setMyGroups(data?.map(m => m.groups).filter(Boolean) || [])
  }

  async function openAddToGroup(person, e) {
    e.stopPropagation()
    await fetchMyGroups()
    setAddTarget(person)
    setAddSuccess(null)
  }

  async function addToGroup(groupId) {
    if (!addTarget) return
    setAddingToGroup(groupId)

    // Check if already a member
    const { data: existing } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', addTarget.id)
      .single()

    if (existing) {
      setAddSuccess({ groupId, msg: 'Already in this group' })
      setAddingToGroup(null)
      return
    }

    // Check group size
    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)

    if (count >= 6) {
      setAddSuccess({ groupId, msg: 'Group is full (6 max)' })
      setAddingToGroup(null)
      return
    }

    await supabase.from('group_members').insert({ group_id: groupId, user_id: addTarget.id })
    setAddSuccess({ groupId, msg: 'Added!' })
    setAddingToGroup(null)
    setTimeout(() => { setAddTarget(null); setAddSuccess(null); fetchFriends() }, 1500)
  }

  async function searchUsers(query) {
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('users')
      .select('id, name, avatar_url, avatar_initials')
      .ilike('name', `%${query.trim()}%`)
      .neq('id', user.id)
      .limit(8)
    setSearchResults(data || [])
    setSearching(false)
  }

  function openThreadFromSearch(person) {
    setActiveThread({ ...person, groups: [] })
    setSearch('')
    setSearchResults([])
  }

  async function loadThread(friendId) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    setMessages(data || [])
    await markRead(friendId)
    setUnreadCounts(prev => ({ ...prev, [friendId]: 0 }))
  }

  async function markRead(fromId) {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('to_user_id', user.id)
      .eq('from_user_id', fromId)
      .eq('read', false)
  }

  async function sendMessage(e) {
    e?.preventDefault()
    const content = newMsg.trim()
    if (!content || !activeThread || sending) return
    setSending(true)
    setNewMsg('')

    const { data } = await supabase
      .from('messages')
      .insert({ from_user_id: user.id, to_user_id: activeThread.id, content })
      .select()
      .single()

    if (data) setMessages(prev => [...prev, data])
    setSending(false)
    inputRef.current?.focus()
  }

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  if (loading) return <LoadingPulse lines={4} />

  // Thread view
  if (activeThread) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { setActiveThread(null); setMessages([]) }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream2 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <Avatar userId={activeThread.id} avatarUrl={activeThread.avatar_url} initials={activeThread.avatar_initials} size="md" />
          <div>
            <p className="font-medium text-text text-sm">{activeThread.name}</p>
            <p className="text-[10px] text-text3">{activeThread.groups?.join(', ')}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 pb-2">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-text3">No messages yet.</p>
              <p className="text-xs text-text3 mt-1">Say something to {activeThread.name?.split(' ')[0]} 👋</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isMe = msg.from_user_id === user.id
            const showTime = i === 0 || new Date(msg.created_at) - new Date(messages[i - 1].created_at) > 5 * 60 * 1000
            return (
              <div key={msg.id}>
                {showTime && (
                  <p className="text-center text-[10px] text-text3 my-2">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-burg text-cream rounded-br-sm'
                        : 'bg-white border border-border text-text rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-cream2">
          <input
            ref={inputRef}
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder={`Message ${activeThread.name?.split(' ')[0]}…`}
            className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm text-text focus:outline-none focus:border-burg placeholder-text3"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          />
          <button
            type="submit"
            disabled={!newMsg.trim() || sending}
            className="w-10 h-10 bg-burg text-cream rounded-full flex items-center justify-center hover:bg-burg-light transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22,2 15,22 11,13 2,9"/>
            </svg>
          </button>
        </form>
      </div>
    )
  }

  // Friends list
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-[26px] text-text tracking-tight">Friends</h1>
        {totalUnread > 0 && (
          <span className="text-xs font-semibold text-cream bg-burg px-2.5 py-1 rounded-full">
            {totalUnread} unread
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-4 py-2.5 focus-within:border-burg transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text3 flex-shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => { setSearch(e.target.value); searchUsers(e.target.value) }}
            placeholder="Search people by name…"
            className="flex-1 text-sm text-text bg-transparent focus:outline-none placeholder-text3"
          />
          {search && (
            <button onClick={() => { setSearch(''); setSearchResults([]) }} className="text-text3 hover:text-text2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-card overflow-hidden z-10">
            {searching && <p className="text-xs text-text3 px-4 py-2">Searching…</p>}
            {searchResults.map(person => (
              <div key={person.id} className="flex items-center gap-2 px-4 py-3 border-b border-cream2 last:border-0 hover:bg-cream2 transition-colors">
                <button onClick={() => openThreadFromSearch(person)} className="flex items-center gap-3 flex-1 text-left">
                  <Avatar userId={person.id} avatarUrl={person.avatar_url} initials={person.avatar_initials} size="sm" />
                  <p className="text-sm font-medium text-text">{person.name}</p>
                </button>
                <button
                  onClick={e => openAddToGroup(person, e)}
                  className="text-[11px] font-medium text-burg border border-burg rounded-lg px-2.5 py-1 hover:bg-burg hover:text-cream transition-colors flex-shrink-0"
                >
                  + Group
                </button>
              </div>
            ))}
          </div>
        )}
        {search && !searching && searchResults.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-card px-4 py-3 z-10">
            <p className="text-sm text-text3">No one found with that name.</p>
          </div>
        )}
      </div>

      {friends.length === 0 ? (
        <div className="bg-white border border-border rounded-xl shadow-card p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream2 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text3">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">No friends yet</p>
          <p className="text-xs text-text3">Join or create a group to connect with people.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map(friend => {
            const unread = unreadCounts[friend.id] || 0
            return (
              <button
                key={friend.id}
                onClick={() => setActiveThread(friend)}
                className="w-full bg-white border border-border rounded-xl shadow-card px-4 py-3.5 flex items-center gap-3 hover:bg-cream2 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <Avatar userId={friend.id} avatarUrl={friend.avatar_url} initials={friend.avatar_initials} size="md" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-burg text-cream text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${unread > 0 ? 'font-semibold text-text' : 'font-medium text-text'}`}>
                    {friend.name}
                  </p>
                  <p className="text-xs text-text3 truncate">
                    {friend.commitment_text || <span className="italic">No commitment this week</span>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <DayTrack states={friend.dayStates} />
                  <p className="text-[10px] text-text3">{friend.groups.join(', ')}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Add to group modal */}
      {addTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(26,10,16,0.4)' }} onClick={() => setAddTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <p className="font-serif text-[18px] text-text mb-1">Add {addTarget.name?.split(' ')[0]} to a group</p>
            <p className="text-xs text-text3 mb-4">Pick which group to add them to.</p>
            {myGroups.length === 0 ? (
              <p className="text-sm text-text3">You don't have any groups yet.</p>
            ) : (
              <div className="space-y-2">
                {myGroups.map(g => {
                  const result = addSuccess?.groupId === g.id
                  return (
                    <button
                      key={g.id}
                      onClick={() => addToGroup(g.id)}
                      disabled={!!addingToGroup || !!addSuccess}
                      className="w-full flex items-center justify-between px-4 py-3 bg-cream2 hover:bg-cream3 border border-border rounded-xl text-sm font-medium text-text transition-colors disabled:opacity-60"
                    >
                      <span>{g.name}</span>
                      {addingToGroup === g.id && <span className="text-xs text-text3">Adding…</span>}
                      {result && <span className={`text-xs font-semibold ${addSuccess.msg === 'Added!' ? 'text-burg' : 'text-text3'}`}>{addSuccess.msg}</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={() => setAddTarget(null)} className="mt-4 w-full py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
