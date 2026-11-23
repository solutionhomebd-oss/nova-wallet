import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import LogoMark from './LogoMark'
import { useApp } from '../lib/store'

// Floating install banner: shown to website (browser) visitors only. It hides
// forever once the app is installed / opened standalone, and for the rest of
// the session when dismissed. Installing for real credits the $2 bonus: the
// claim runs server-side on the first standalone launch (once per account).
export default function InstallBanner() {
  const { user, locked, appInstalled, claimAppBonus, t } = useApp()
  const location = useLocation()
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('nw.installBannerOff') === '1' } catch { return false } })
  const [showHow, setShowHow] = useState(false)
  const claimRef = useRef(claimAppBonus)
  claimRef.current = claimAppBonus
  const claimedFor = useRef<string | null>(null)

  useEffect(() => {
    const done = () => setDismissed(true)
    window.addEventListener('appinstalled', done)
    return () => window.removeEventListener('appinstalled', done)
  }, [])

  useEffect(() => {
    if (appInstalled && user && claimedFor.current !== user.id) {
      claimedFor.current = user.id
      void claimRef.current()
    }
  }, [appInstalled, user?.id])

  if (appInstalled || dismissed || locked || location.pathname.startsWith('/admin')) return null

  const install = async () => {
    const prompt = (window as any).__nwInstallPrompt
    if (prompt) {
      prompt.prompt()
      const choice = await prompt.userChoice
      if (choice?.outcome === 'accepted') (window as any).__nwInstallPrompt = null
    } else setShowHow(v => !v)
  }
  const close = () => { try { sessionStorage.setItem('nw.installBannerOff', '1') } catch { /* ignore */ } setDismissed(true) }

  return (
    <div className="fixed z-[80] inset-x-3 bottom-[86px] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[368px] anim-fade-up">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 text-white p-4 shadow-2xl shadow-violet-900/40">
        <button onClick={close} aria-label="Dismiss" className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition"><X size={14} /></button>
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-2xl bg-white/10 p-1.5"><LogoMark size={38} /></span>
          <div className="flex-1 min-w-0 pr-5">
            <p className="font-extrabold text-[15px] leading-tight">{t('install_title')}</p>
            <p className="text-xs text-violet-100/90 mt-0.5 leading-snug">{t('install_body')}</p>
          </div>
        </div>
        <button onClick={install} className="mt-3 w-full py-2.5 rounded-2xl bg-white text-violet-700 font-extrabold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition shadow"><Download size={16} /> {t('install_now')}</button>
        {showHow && <p className="mt-2.5 text-xs text-violet-100 leading-relaxed bg-white/10 rounded-xl px-3 py-2">{t('install_how')}</p>}
      </div>
    </div>
  )
}
