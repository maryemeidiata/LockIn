import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function useNotifications(userId) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  useEffect(() => {
    if (!userId || permission !== 'granted') return
    register(userId)
  }, [userId, permission])

  async function register(uid) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      await supabase.from('push_subscriptions').upsert(
        { user_id: uid, subscription: sub.toJSON() },
        { onConflict: 'user_id' }
      )
    } catch (e) {
      console.error('Push registration failed:', e)
    }
  }

  async function requestPermission(uid) {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') await register(uid)
  }

  return { permission, requestPermission }
}
