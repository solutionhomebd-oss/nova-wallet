import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Btn, Card, Modal } from '../components/ui'
import { PageHead } from './Services'
import { fmtUSDT, fmtDateTime } from '../lib/utils'
import { ADS_PER_DAY, CHECKIN_REWARDS, EARN_TASKS, SPINS_PER_DAY, WHEEL_PRIZES } from '../lib/earn'

const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
const yesterdayStr = () => { const t = new Date(todayStr() + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10) }

const REWARD_TITLES = ['Daily check-in reward', 'Watched ad reward', 'Spin Wheel reward', 'Scratch card reward', 'Task reward:', 'Daily quiz reward']
const isRewardTx = (x: { category: string; title: string }) => x.category === 'earn' && REWARD_TITLES.some(t => x.title.startsWith(t))
const isToday = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }) === todayStr()

export function EarnSummary() {
  const { db, user } = useApp()
  if (!user) return null
  const rate = db.settings.bdtPerUsd
  const earned = db.txs.filter(x => x.userId === user.id && isRewardTx(x) && isToday(x.createdAt)).reduce((a, x) => a + x.amount, 0)
  return (
    <Card className="p-4 mb-4 flex items-center gap-3 !bg-gradient-to-r from-violet-600/10 to-cyan-500/10 !border-violet-200/60 dark:!border-violet-500/20">
      <span className="text-2xl">💰</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Earned today from rewards</p>
        <p className="font-extrabold text-lg leading-tight">{fmtUSDT(earned / rate)}</p>
      </div>
      <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 shrink-0">PAID IN USDT</span>
    </Card>
  )
}

export function EarnHistory() {
  const { db, user } = useApp()
  if (!user) return null
  const rate = db.settings.bdtPerUsd
  const rows = db.txs.filter(x => x.userId === user.id && isRewardTx(x)).slice(0, 5)
  if (!rows.length) return null
  return (
    <>
      <h3 className="font-extrabold mt-6 mb-3">Recent rewards</h3>
      <div className="space-y-2">{rows.map(x => (
        <Card key={x.id} className="p-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{x.title}</p><p className="text-xs text-slate-400">{fmtDateTime(x.createdAt)}</p></div>
          <span className="font-extrabold text-emerald-600 shrink-0">+{fmtUSDT(x.amount / rate)}</span>
        </Card>
      ))}</div>
    </>
  )
}

function Pips({ total, used, color = 'bg-violet-500' }: { total: number; used: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < used ? color : 'bg-slate-200 dark:bg-slate-700'}`} />)}
    </div>
  )
}

function BackLink() {
  return <Link to="/earn" className="inline-flex items-center gap-1 text-sm font-bold text-violet-600 mb-3">← Back to Earn</Link>
}

/* ---------------- Daily Check-in ---------------- */
export function CheckinPage() {
  const { earnInfo, claimCheckin, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const claimed = info.lastCheckin === todayStr()
  const continuing = info.lastCheckin === yesterdayStr()
  const filled = claimed ? ((info.streak - 1) % 7) + 1 : continuing ? info.streak % 7 : 0
  const nextReward = CHECKIN_REWARDS[filled % 7]
  const claim = async () => {
    const r = await claimCheckin()
    if (r.err) return toast({ kind: 'error', title: r.err })
    toast({ kind: 'success', title: 'Check-in reward ✓', body: '+' + usd(r.amount ?? 0) + ' · Day ' + r.streak + ' streak · Added to your balance — come back tomorrow for the next reward.' })
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Daily Check-in" sub="Check in every day to build your streak — longer streaks pay more." />
      <EarnSummary />
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div><p className="text-xs text-slate-400 font-bold uppercase">Current streak</p><p className="text-2xl font-extrabold">🔥 {info.streak} day{info.streak === 1 ? '' : 's'}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400 font-bold uppercase">{claimed ? "Tomorrow's reward" : "Today's reward"}</p><p className="text-2xl font-extrabold text-emerald-500">{usd(nextReward)}</p></div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-5">
          {CHECKIN_REWARDS.map((r, i) => (
            <div key={i} className={`rounded-xl py-2.5 text-center border-2 ${i < filled ? 'bg-emerald-500 border-emerald-500 text-white' : i === filled && !claimed ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              <p className="text-sm">{i < filled ? '✓' : '🎁'}</p>
              <p className="text-[10px] font-extrabold mt-0.5">{usd(r)}</p>
              <p className="text-[9px] opacity-70 font-bold">Day {i + 1}</p>
            </div>
          ))}
        </div>
        <Btn className="w-full py-3.5" disabled={claimed} onClick={claim}>{claimed ? '✓ Claimed today — see you tomorrow' : 'Claim ' + usd(nextReward)}</Btn>
        <p className="text-xs text-slate-400 text-center mt-3">Rewards go straight to your available balance. Missing a day restarts the streak.</p>
      </Card>
      <EarnHistory />
    </div>
  )
}

/* ---------------- View Ads (Adsterra Banner 300x250, in-card) ---------------- */
function AdsterraBanner() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || el.dataset.loaded) return
    el.dataset.loaded = '1'
    ;(window as unknown as { atOptions?: unknown }).atOptions = {
      key: 'dfa6ed35125429e4aa96f8b0a2ae7b6b',
      format: 'iframe',
      height: 250,
      width: 300,
      params: {},
    }
    const s = document.createElement('script')
    s.src = 'https://bauval.org/22/dfa6ed35125429e4aa96f8b0a2ae7b6b'
    s.async = true
    s.setAttribute('data-cfasync', 'false')
    el.appendChild(s)
  }, [])
  return <div ref={ref} className="w-[300px] max-w-full min-h-[250px]" />
}
const AD_INVOKE_URL = 'https://bauval.org/22/dfa6ed35125429e4aa96f8b0a2ae7b6b'
async function adBlockerActive(): Promise<boolean> {
  // 1) Cosmetic-filter bait — AdGuard / uBlock element hiding kills the bait box
  try {
    const bait = document.createElement('div')
    bait.className = 'adsbygoogle ad-banner ad-slot textads banner_ad pub_300x250'
    bait.style.cssText = 'position:absolute;top:-20px;left:-20px;width:12px;height:12px;pointer-events:none;'
    document.body.appendChild(bait)
    await new Promise(r => setTimeout(r, 150))
    const cs = getComputedStyle(bait)
    const hidden = bait.offsetHeight === 0 || cs.display === 'none' || cs.visibility === 'hidden'
    bait.remove()
    if (hidden) return true
  } catch { /* ignore */ }
  // 2) Network test — DNS-level blockers (e.g. AdGuard Private DNS) kill the ad domain itself
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    await fetch(AD_INVOKE_URL + '?nwprobe=' + Date.now(), { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    return false
  } catch { return true }
}
export function AdsPage() {
  const { earnInfo, watchAdReward, toast, db, user } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const left = ADS_PER_DAY - info.ads
  // A watched-but-unclaimed ad locks the next watch until it is claimed —
  // the lock survives leaving and re-entering the page.
  const pendingKey = 'nw.adPending.' + (user?.id ?? '')
  const [phase, setPhase] = useState<'idle' | 'watching' | 'done'>(() => { try { return localStorage.getItem(pendingKey) ? 'done' : 'idle' } catch { return 'idle' } })
  const [progress, setProgress] = useState(0)
  const [checking, setChecking] = useState(false)
  const [blockWarn, setBlockWarn] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  const startWatch = () => {
    setPhase('watching'); setProgress(0)
    timer.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (timer.current) clearInterval(timer.current)
          try { localStorage.setItem(pendingKey, '1') } catch { /* ignore */ }
          setPhase('done'); return 100
        }
        return p + 1
      })
    }, 100)
  }
  const watch = async () => {
    if (checking || phase !== 'idle') return
    setChecking(true)
    const blocked = await adBlockerActive()
    setChecking(false)
    if (blocked) { setBlockWarn(true); return }
    startWatch()
  }
  const claim = async () => {
    const r = await watchAdReward()
    if (r.err) return toast({ kind: 'error', title: r.err })
    try { localStorage.removeItem(pendingKey) } catch { /* ignore */ }
    toast({ kind: 'success', title: 'Ad reward ✓', body: '+' + usd(r.amount ?? 0) + ' · ' + (r.left ?? 0) + ' ads left today · Added to your balance' })
    setPhase('idle'); setProgress(0)
  }
  return (
    <div>
      <BackLink />
      <PageHead title="View Ads" sub={`Watch a short ad and earn ${usd(2)}–${usd(8)} each time. ${left} of ${ADS_PER_DAY} left today.`} />
      <EarnSummary />
      <Card className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center">Advertisement</p>
        <div className="relative mt-3 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800/60 min-h-[250px] flex items-center justify-center">
          <AdsterraBanner />
          {phase === 'watching' && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/25"><div className="h-full bg-violet-500 transition-all" style={{ width: progress + '%' }} /></div>}
        </div>
        {phase === 'watching' && <p className="text-center text-xs font-bold text-slate-400 mt-2">Your ad is playing — keep this page open…</p>}
        <div className="mt-4"><Pips total={ADS_PER_DAY} used={info.ads} /><p className="text-[11px] font-bold text-slate-400 mt-1.5">{info.ads} of {ADS_PER_DAY} ads watched today</p></div>
        {phase === 'watching' && <p className="text-center text-sm font-bold text-slate-500 mt-4">Watching ad… {Math.ceil((100 - progress) / 10)}s</p>}
        {phase === 'idle' && <Btn className="w-full py-3.5 mt-4" disabled={left <= 0 || checking} onClick={watch}>{left <= 0 ? 'No ads left today' : checking ? 'Checking…' : '▶ Watch ad (10s)'}</Btn>}
        {phase === 'done' && <Btn className="w-full py-3.5 mt-4" onClick={claim}>Claim reward</Btn>}
        {phase === 'done' && <p className="text-xs font-bold text-amber-500 text-center mt-2">Claim this reward to unlock the next ad.</p>}
        <p className="text-xs text-slate-400 text-center mt-3">The reward is credited to your available balance as soon as you claim it.</p>
      </Card>
      <EarnHistory />
      <Modal open={blockWarn} onClose={() => setBlockWarn(false)} title="⚠ Ad Blocker Detected">
        <p className="text-sm text-slate-500 dark:text-slate-400">It looks like <b>AdGuard</b> or another ad blocker is turned on. While it is active, ads can't load — so ad rewards can't be earned here.</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Please turn off your ad blocker for <b>novawallet.pp.ua</b>. If you use AdGuard Private DNS, set your phone's Private DNS to <b>Automatic</b>. Then tap Try Again.</p>
        <div className="flex gap-2 mt-5">
          <Btn className="flex-1 py-3" onClick={() => { setBlockWarn(false); void watch() }}>Try Again</Btn>
          <Btn variant="ghost" className="flex-1 py-3" onClick={() => setBlockWarn(false)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  )
}

/* ---------------- Spin Wheel ---------------- */
const SEG_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#64748b', '#8b5cf6', '#f43f5e']
export function SpinPage() {
  const { earnInfo, spinReward, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const left = SPINS_PER_DAY - info.spins
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [lastPrize, setLastPrize] = useState<number | null>(null)
  const gradient = 'conic-gradient(from 0deg, ' + WHEEL_PRIZES.map((_, i) => `${SEG_COLORS[i]} ${i * 45}deg ${(i + 1) * 45}deg`).join(', ') + ')'
  const spin = async () => {
    const r = await spinReward()
    if (r.err) return toast({ kind: 'error', title: r.err })
    const seg = 45
    const targetMod = (360 - ((r.index ?? 0) * seg + seg / 2) + 360) % 360
    const delta = (targetMod - (rot % 360) + 360) % 360
    setRot(rot + 360 * 5 + delta)
    setSpinning(true); setLastPrize(null)
    setTimeout(() => {
      setSpinning(false); setLastPrize(r.prize ?? 0)
      if ((r.prize ?? 0) > 0) toast({ kind: 'success', title: '🎉 You won ' + usd(r.prize ?? 0), body: 'Added to your balance. ' + (r.left ?? 0) + ' spins left today.' })
      else toast({ kind: 'info', title: 'No prize this time', body: (r.left ?? 0) + ' spins left today — try again!' })
    }, 4300)
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Spin Wheel" sub={`Spin the wheel and win up to ${usd(50)}. ${left} of ${SPINS_PER_DAY} free spins left today.`} />
      <EarnSummary />
      <Card className="p-5 flex flex-col items-center">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72">
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-2xl">▼</div>
          <div className="w-full h-full rounded-full border-8 border-white dark:border-slate-700 shadow-xl relative overflow-hidden" style={{ background: gradient, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.8, 0.08, 1)' : 'none' }}>
            {WHEEL_PRIZES.map((p, i) => (
              <div key={i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${i * 45 + 22.5}deg)` }}>
                <span className="mt-4 text-white font-extrabold text-sm drop-shadow">{p === 0 ? '✕' : (p / db.settings.bdtPerUsd).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white dark:bg-slate-800 shadow flex items-center justify-center text-xl">🎡</div>
        </div>
        {lastPrize !== null && <p className="font-extrabold mt-4">{lastPrize > 0 ? '🎉 You won ' + usd(lastPrize) : 'No prize — better luck next spin!'}</p>}
        <div className="w-full mt-4"><Pips total={SPINS_PER_DAY} used={info.spins} /><p className="text-[11px] font-bold text-slate-400 mt-1.5 text-center">Wheel prizes: {[...new Set(WHEEL_PRIZES)].sort((a, b) => a - b).map(x => (x / db.settings.bdtPerUsd).toFixed(2)).join(' · ')} USDT</p></div>
        <Btn className="w-full py-3.5 mt-4" disabled={spinning || left <= 0} onClick={spin}>{spinning ? 'Spinning…' : left <= 0 ? 'No spins left today' : 'Spin now (free)'}</Btn>
      </Card>
      <EarnHistory />
    </div>
  )
}

/* ---------------- Complete Tasks ---------------- */
export function TasksPage() {
  const { earnInfo, completeEarnTask, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const [phase, setPhase] = useState<Record<string, number>>({})
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  useEffect(() => () => { Object.values(timers.current).forEach(clearInterval) }, [])
  const start = (id: string) => {
    setPhase(p => ({ ...p, [id]: 5 }))
    timers.current[id] = setInterval(() => {
      setPhase(p => {
        const v = (p[id] ?? 0) - 1
        if (v <= 0) { clearInterval(timers.current[id]); return { ...p, [id]: 0 } }
        return { ...p, [id]: v }
      })
    }, 1000)
  }
  const claim = async (id: string) => {
    const r = await completeEarnTask(id)
    if (r.err) return toast({ kind: 'error', title: r.err })
    toast({ kind: 'success', title: 'Task reward ✓', body: (EARN_TASKS.find(x => x.id === id)?.title ?? id) + ' · +' + usd(r.amount ?? 0) + ' · Added to your balance' })
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Complete Tasks" sub="Finish simple tasks and earn USDT for each one. Tasks can be completed once." />
      <EarnSummary />
      <Card className="p-4 mb-4">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-2"><span>{info.tasksDone.length} of {EARN_TASKS.length} tasks completed</span><span>Total value {usd(EARN_TASKS.reduce((a, x) => a + x.reward, 0))}</span></div>
        <Pips total={EARN_TASKS.length} used={info.tasksDone.length} color="bg-emerald-500" />
      </Card>
      <div className="space-y-2.5">
        {EARN_TASKS.map(task => {
          const done = info.tasksDone.includes(task.id)
          const counting = phase[task.id] !== undefined && phase[task.id] > 0
          const ready = phase[task.id] === 0
          return (
            <Card key={task.id} className="p-4 flex items-center gap-3">
              <span className="text-2xl w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{task.title}</p>
                <p className="text-xs text-slate-400">{task.desc}</p>
                <p className="text-xs font-extrabold text-emerald-600 mt-0.5">Reward {usd(task.reward)}</p>
              </div>
              {done ? <span className="font-extrabold text-emerald-600 text-sm shrink-0">✓ Done</span>
                : counting ? <Btn className="!py-2 !text-xs shrink-0" disabled>Verifying… {phase[task.id]}s</Btn>
                : ready ? <Btn className="!py-2 !text-xs shrink-0" onClick={() => claim(task.id)}>Claim {usd(task.reward)}</Btn>
                : <Btn className="!py-2 !text-xs shrink-0" onClick={() => start(task.id)}>Start</Btn>}
            </Card>
          )
        })}
      </div>
      <EarnHistory />
    </div>
  )
}

