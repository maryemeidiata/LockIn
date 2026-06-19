import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from '../components/ui/Avatar'

export default function Feed() {
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (user) fetchPosts()
  }, [user])

  async function fetchPosts() {
    setLoading(true)
    setFetchError('')
    const { data, error } = await supabase
      .from('feed_posts')
      .select('*, users!feed_posts_user_id_fkey(id, name, avatar_initials, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) setFetchError(error.message)
    setPosts(data || [])
    setLoading(false)
  }

  async function deletePost(postId) {
    await supabase.from('feed_posts').delete().eq('id', postId)
    setPosts(p => p.filter(post => post.id !== postId))
  }

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'rgba(107,30,58,0.08)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--burg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </div>
        <div>
          <h1 className="font-serif text-[22px] text-text tracking-tight leading-none mb-0.5">Feed</h1>
          <p className="text-xs text-text3">What's happening in your groups</p>
        </div>
      </div>

      {/* Compose bar */}
      <button
        onClick={() => setShowCompose(true)}
        className="w-full bg-white border border-border rounded-2xl shadow-card px-4 py-3 flex items-center gap-3 mb-5 hover:border-burg/30 transition-colors text-left"
      >
        <Avatar userId={user?.id} initials={profile?.avatar_initials} avatarUrl={profile?.avatar_url} size="sm" />
        <span className="text-sm text-text3 flex-1">What's on your mind?</span>
        <span className="text-xs font-medium text-burg px-3 py-1 rounded-full" style={{background:'rgba(107,30,58,0.08)'}}>Post</span>
      </button>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-xs text-red-700 font-mono">
          DB error: {fetchError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-border rounded-xl shadow-card p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-cream2" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-cream2 rounded w-28" />
                  <div className="h-2.5 bg-cream2 rounded w-16" />
                </div>
              </div>
              <div className="h-3 bg-cream2 rounded w-4/5 mb-2" />
              <div className="h-3 bg-cream2 rounded w-3/5" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-border rounded-2xl shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cream2 flex items-center justify-center mx-auto mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--burg-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-text mb-1">Nothing here yet</p>
          <p className="text-xs text-text3 mb-5 max-w-xs mx-auto">Your crew hasn't posted anything yet. Be the one who starts the conversation.</p>
          <button
            onClick={() => setShowCompose(true)}
            className="px-5 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            Write the first post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user.id}
              timeAgo={timeAgo}
              onDelete={deletePost}
            />
          ))}
        </div>
      )}

      {showCompose && (
        <ComposeModal
          userId={user.id}
          profile={profile}
          onClose={() => setShowCompose(false)}
          onPosted={(newPost) => {
            setPosts(p => [{ ...newPost, users: { id: user.id, name: profile?.name, avatar_initials: profile?.avatar_initials, avatar_url: profile?.avatar_url } }, ...p])
            setShowCompose(false)
          }}
        />
      )}
    </div>
  )
}

function PostCard({ post, currentUserId, timeAgo, onDelete }) {
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [comments, setComments] = useState([])
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    async function fetchLikes() {
      const { data } = await supabase.from('feed_likes').select('user_id').eq('post_id', post.id)
      setLikeCount(data?.length || 0)
      setLiked(data?.some(l => l.user_id === currentUserId) || false)
    }
    async function fetchCommentCount() {
      const { count } = await supabase.from('feed_comments').select('id', { count: 'exact', head: true }).eq('post_id', post.id)
      setCommentCount(count || 0)
    }
    fetchLikes()
    fetchCommentCount()
  }, [post.id])

  useEffect(() => {
    if (showComments) fetchComments()
  }, [showComments])

  useEffect(() => {
    if (showComments && inputRef.current) inputRef.current.focus()
  }, [showComments])

  async function fetchComments() {
    const { data } = await supabase
      .from('feed_comments')
      .select('id, comment_text, created_at, user_id, users!feed_comments_user_id_fkey(id, name, avatar_initials, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function toggleLike() {
    if (likeLoading) return
    setLikeLoading(true)
    if (liked) {
      await supabase.from('feed_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId)
      setLiked(false)
      setLikeCount(n => n - 1)
    } else {
      await supabase.from('feed_likes').insert({ post_id: post.id, user_id: currentUserId })
      setLiked(true)
      setLikeCount(n => n + 1)
    }
    setLikeLoading(false)
  }

  async function submitComment(e) {
    e.preventDefault()
    if (!commentText.trim() || commentLoading) return
    setCommentLoading(true)
    const { data } = await supabase
      .from('feed_comments')
      .insert({ post_id: post.id, user_id: currentUserId, comment_text: commentText.trim() })
      .select('id, comment_text, created_at, user_id, users!feed_comments_user_id_fkey(id, name, avatar_initials, avatar_url)')
      .single()
    if (data) {
      setComments(prev => [...prev, data])
      setCommentCount(n => n + 1)
    }
    setCommentText('')
    setCommentLoading(false)
  }

  async function deleteComment(commentId) {
    await supabase.from('feed_comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
    setCommentCount(n => n - 1)
  }

  const u = post.users

  return (
    <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Avatar userId={u?.id} initials={u?.avatar_initials} avatarUrl={u?.avatar_url} size="sm" />
          <div>
            <p className="text-sm font-medium text-text">{u?.name || 'Unknown'}</p>
            <p className="text-[11px] text-text3">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        {post.user_id === currentUserId && (
          <button onClick={() => onDelete(post.id)} className="text-xs text-text3 hover:text-burg transition-colors">
            Delete
          </button>
        )}
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-5 text-sm text-text leading-relaxed pb-3">{post.caption}</p>
      )}

      {/* Media */}
      {post.media_url && post.media_type === 'image' && (
        <div className="bg-cream2 flex items-center justify-center">
          <img src={post.media_url} alt="Post" className="w-full max-h-[480px] object-contain" />
        </div>
      )}
      {post.media_url && post.media_type === 'video' && (
        <video src={post.media_url} controls className="w-full max-h-[480px] bg-black" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-cream2">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-burg' : 'text-text3 hover:text-burg'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
          <span className="text-[13px] font-medium">{likeCount > 0 ? likeCount : ''}</span>
        </button>

        <button
          onClick={() => setShowComments(v => !v)}
          className={`flex items-center gap-1.5 transition-colors ${showComments ? 'text-burg' : 'text-text3 hover:text-burg'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span className="text-[13px] font-medium">{commentCount > 0 ? commentCount : ''}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-cream2">
          {comments.length > 0 && (
            <div className="px-5 pt-3 space-y-3">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5 group">
                  <Avatar userId={c.users?.id} initials={c.users?.avatar_initials} avatarUrl={c.users?.avatar_url} size="xs" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold text-text mr-1.5">{c.users?.name || 'Unknown'}</span>
                    <span className="text-[13px] text-text leading-snug">{c.comment_text}</span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-text3">{timeAgo(c.created_at)}</span>
                      {c.user_id === currentUserId && (
                        <button onClick={() => deleteComment(c.id)} className="text-[11px] text-text3 hover:text-burg opacity-0 group-hover:opacity-100 transition-opacity">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitComment} className="flex items-center gap-2.5 px-5 py-3">
            <input
              ref={inputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 text-sm text-text placeholder-text3 bg-cream2 rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-burg/30"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || commentLoading}
              className="text-[13px] font-semibold text-burg disabled:opacity-40 transition-opacity"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function ComposeModal({ userId, profile, onClose, onPosted }) {
  const [caption, setCaption] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  function handleMediaSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('video') ? 'video' : 'image'
    setMediaFile(file)
    setMediaType(type)
    setMediaPreview(URL.createObjectURL(file))
  }

  function removeMedia() {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaType(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePost() {
    if (!caption.trim() && !mediaFile) { setError('Write something or add a photo.'); return }
    setLoading(true)
    setError('')

    let media_url = null

    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop()
      const path = `${userId}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('feed-media')
        .upload(path, mediaFile, { contentType: mediaFile.type })
      if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setLoading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('feed-media').getPublicUrl(path)
      media_url = publicUrl
    }

    const { data, error: postErr } = await supabase
      .from('feed_posts')
      .insert({ user_id: userId, caption: caption.trim() || null, media_url, media_type: mediaType })
      .select()
      .single()

    setLoading(false)
    if (postErr) { setError(postErr.message); return }
    if (!data) { setError('Post failed to save. Please try again.'); return }
    onPosted(data)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-5 pb-8 sm:pb-5" onClick={e => e.stopPropagation()}>
        {/* Author */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar userId={userId} initials={profile?.avatar_initials} avatarUrl={profile?.avatar_url} size="sm" />
          <p className="text-sm font-medium text-text">{profile?.name}</p>
        </div>

        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={3}
          autoFocus
          placeholder="What's on your mind?"
          className="w-full text-sm text-text placeholder-text3 focus:outline-none resize-none mb-3"
        />

        {mediaPreview && (
          <div className="relative mb-3">
            {mediaType === 'image' ? (
              <img src={mediaPreview} alt="Preview" className="w-full h-48 object-cover rounded-xl border border-border" />
            ) : (
              <video src={mediaPreview} className="w-full h-48 object-cover rounded-xl border border-border" />
            )}
            <button
              onClick={removeMedia}
              className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm text-text2 hover:text-burg"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {error && <p className="text-xs text-burg mb-3">{error}</p>}

        <div className="flex items-center justify-between pt-3 border-t border-cream2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-text3 hover:text-burg transition-colors text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Photo / video
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} />

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text2 bg-cream2 border border-border rounded-[10px] hover:bg-cream3 transition-colors">
              Cancel
            </button>
            <button
              onClick={handlePost}
              disabled={loading || (!caption.trim() && !mediaFile)}
              className="px-4 py-2 text-sm font-medium text-cream bg-burg rounded-[10px] hover:bg-burg-light transition-colors disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
