// Shared one-tap install, used by the floating banner and Profile's
// "Install App" row. Uses the beforeinstallprompt event captured in main.tsx.
// If the event has not arrived yet, waits briefly for it — Chrome often fires
// it a moment after page load, and a click inside that gap used to fall
// through to manual instructions. Resolves how the attempt ended.
export function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  return new Promise(resolve => {
    const fire = (evt: any) => {
      try { evt.prompt() } catch { resolve('unavailable'); return }
      evt.userChoice
        .then((c: any) => {
          if ((window as any).__nwInstallPrompt === evt) (window as any).__nwInstallPrompt = null
          resolve(c?.outcome === 'accepted' ? 'accepted' : 'dismissed')
        })
        .catch(() => resolve('dismissed'))
    }
    const existing = (window as any).__nwInstallPrompt
    if (existing) { fire(existing); return }
    let settled = false
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('nw-install-ready', onReady) }
    const onReady = () => {
      if (settled) return
      const evt = (window as any).__nwInstallPrompt
      if (evt) { settled = true; cleanup(); fire(evt) }
    }
    const timer = setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve('unavailable') } }, 2500)
    window.addEventListener('nw-install-ready', onReady)
  })
}
