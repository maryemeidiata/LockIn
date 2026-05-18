import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getDayIndex } from '../lib/weekUtils'

export default function CheckInButton({ commitmentId, alreadyCheckedIn, onCheckIn }) {
  const { user } = useAuth()
  const [step, setStep] = useState('idle') // idle | photo | uploading | done
  const [done, setDone] = useState(alreadyCheckedIn)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const fileRef = useRef()

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submitCheckIn(withPhoto) {
    setStep('uploading')
    let photo_url = null

    if (withPhoto && photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${user.id}/${commitmentId}-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('checkin-photos')
        .upload(path, photoFile, { contentType: photoFile.type })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('checkin-photos').getPublicUrl(path)
        photo_url = publicUrl
      }
    }

    const { error } = await supabase.from('checkins').insert({
      commitment_id: commitmentId,
      user_id: user.id,
      day_of_week: getDayIndex(),
      ...(photo_url ? { photo_url } : {}),
    })

    if (!error) {
      setDone(true)
      setStep('done')
      onCheckIn?.()
    } else {
      setStep('photo')
    }
  }

  if (done) {
    return (
      <div className="w-full min-h-[52px] flex items-center justify-center bg-cream2 border border-border rounded-[10px]">
        <span className="text-sm font-medium text-text2">Checked in for today</span>
      </div>
    )
  }

  // Photo step
  if (step === 'photo') {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-text2 uppercase tracking-wider">Add proof? (optional)</p>

        {photoPreview ? (
          <div className="relative">
            <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-border" />
            <button
              onClick={removePhoto}
              className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm text-text2 hover:text-burg transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-text3 hover:border-burg hover:text-burg transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span className="text-xs font-medium">Add a photo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />

        <div className="flex gap-2">
          <button
            onClick={() => submitCheckIn(false)}
            className="flex-1 py-2.5 bg-cream2 text-text2 text-sm font-medium rounded-[10px] border border-border hover:bg-cream3 transition-colors"
          >
            Skip photo
          </button>
          <button
            onClick={() => submitCheckIn(true)}
            className="flex-1 py-2.5 bg-burg text-cream text-sm font-medium rounded-[10px] hover:bg-burg-light transition-colors"
          >
            {photoFile ? 'Check in with photo' : 'Check in'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'uploading') {
    return (
      <div className="w-full min-h-[52px] flex items-center justify-center bg-cream2 border border-border rounded-[10px]">
        <span className="text-sm text-text3">Checking in...</span>
      </div>
    )
  }

  // Default: idle
  return (
    <button
      onClick={() => setStep('photo')}
      className="w-full min-h-[52px] bg-burg text-cream text-base font-medium rounded-[10px] hover:bg-burg-light transition-colors"
    >
      Check in for today
    </button>
  )
}
