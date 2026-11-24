import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Award, BadgePercent, Coins, Globe, Nfc, Snowflake, Sparkles } from 'lucide-react'
import LogoMark from '../components/LogoMark'
import { useApp } from '../lib/store'
import { withdrawMethods, CRYPTO_NETWORK_LABELS } from '../lib/localPayments'
import { ADS_PER_DAY, EARN_TASKS, SPINS_PER_DAY } from '../lib/earn'
import { COIN_META, useMarket } from '../lib/market'
import { Badge, Btn, Card, Empty, FeatureOff, Input, MaxBtn, Modal, Select, TxDirIcon , StepBar, StepUpField, WizardNav } from '../components/ui'
import { fmtDateTime, fmtUSDT, txAmountCls, txDirection, txSign } from '../lib/utils'
import { PageHead, ResultModal, SuccessModal } from './Services'
import { promptInstall } from '../lib/install'

export function Level2GateModal({ open, onClose, feature }: { open: boolean; onClose: () => void; feature: string }) {
  const navigate = useNavigate()
  return (
    <Modal open={open} onClose={onClose} title="Level 2 required">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 mb-3"><Award size={30} /></div>
        <p className="font-extrabold text-lg">Upgrade to Level 2</p>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{feature} is available on <b className="text-slate-700 dark:text-slate-200">Level 2</b> accounts and above. Your account is currently <b className="text-slate-700 dark:text-slate-200">Level 1</b>. Level 2 unlocks automatically — reach 82.64 USDT in total deposits or complete 50 referrals.</p>
      </div>
      <div className="flex gap-2.5 mt-5">
        <Btn variant="outline" className="flex-1 py-3.5" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1 py-3.5" onClick={() => { onClose(); navigate('/level') }}>See how to unlock</Btn>
      </div>
    </Modal>
  )
}


export function DirectWithdraw() {
  const { directWithdraw, db, user, walletOf, toast, t, currency, fmtMoney, toBDT, fromBDT, stepUp } = useApp()
  const navigate = useNavigate()
  const outMethods = withdrawMethods(currency)
  const [method, setMethod] = useState(''); const [amount, setAmount] = useState(''); const [dest, setDest] = useState(''); const [network, setNetwork] = useState('')
  const [gate, setGate] = useState(false)
  const [stepPw, setStepPw] = useState('')
  const [dwStep, setDwStep] = useState(0)
  const [done, setDone] = useState(false)
  const [lastTx, setLastTx] = useState<{ amount: number; method: string } | null>(null); const [errMsg, setErrMsg] = useState('')
  const amt = Number(amount) || 0
  const amtBDT = Math.round(toBDT(amt))
  const disc = db.levels.find(l => l.level === user?.level)?.feeDiscountPct ?? 0
  const fee = Math.round(amtBDT * db.settings.cashoutFeePct * (1 - disc / 100) / 100)
  const w = user ? walletOf(user.id) : null
  const mine = db.txs.filter(x => x.userId === user?.id && x.category === 'direct_withdraw')
  const activeOut = outMethods.includes(method) ? method : outMethods[0]
  const isCrypto = activeOut === 'Crypto Wallet'
  const activeNetwork = CRYPTO_NETWORK_LABELS.includes(network) ? network : CRYPTO_NETWORK_LABELS[0]
  const fullMethod = isCrypto ? 'Crypto Wallet · ' + activeNetwork : activeOut
  const destLabel = !isCrypto ? 'Destination account / number / address' : activeNetwork === 'Binance Pay' ? 'Binance Pay ID / email' : 'Wallet address'
  const submit = async () => {
    if (!amtBDT || amtBDT < 50) return toast({ kind: 'error', title: 'Minimum payment is ' + fmtMoney(50) })
    if (!dest.trim()) return toast({ kind: 'error', title: 'Enter the destination account' })
    if (user && user.level < 2) return setGate(true)
    const suThD = db.settings.stepUpThresholdBdt ?? 0
    if (suThD && amtBDT > suThD) {
      if (!stepPw) return setErrMsg('This withdrawal is above ৳' + suThD.toLocaleString() + ' — enter your account password for the extra verification.')
      const se = await stepUp(stepPw); if (se) return setErrMsg(se); setStepPw('')
    }
    const err = await directWithdraw({ method: fullMethod, amount: amtBDT, destination: dest.trim() })
    if (err) return setErrMsg(err)
    setLastTx({ amount: amtBDT, method: fullMethod }); setDone(true); setAmount(''); setDwStep(0)
    toast({ kind: 'success', title: 'Payment completed', body: 'Money sent instantly — no admin review needed.' })
  }
  if (!user) return null
  if (db.settings.features?.withdrawals === false) return (
    <div>
      <PageHead title="Payment" sub="Instant · No PIN needed · Level 2" />
      <FeatureOff label="Payment" />
    </div>
  )
  return (
    <div>
      <PageHead title="Payment" sub={`Instant · No PIN needed · Level 2 · ${t('available')} (cash): ${fmtMoney(w?.available ?? 0)}${(w?.holdings.USDT ?? 0) > 0 ? ` · Incl. USDT: ${fmtMoney((w?.available ?? 0) + (w?.holdings.USDT ?? 0) * db.settings.bdtPerUsd)}` : ''}`} />
      {user.level < 2 && (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 p-4 mb-4 flex items-center gap-3">
          <Award size={20} className="text-amber-500 shrink-0" />
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex-1">Payment needs Level 2. It unlocks automatically at 82.64 USDT in total deposits or 50 referrals.</p>
          <Btn variant="outline" onClick={() => navigate('/level')}>Unlock</Btn>
        </div>
      )}
      <Card className="p-5">
        <StepBar steps={['Details', 'Review']} current={dwStep} />
        {dwStep === 0 ? (
        <div className="space-y-4 anim-fade-up">
        <Select label="Payment method" value={activeOut} onChange={(e: any) => setMethod(e.target.value)}>{outMethods.map(m => <option key={m}>{m}</option>)}</Select>
        {isCrypto && <Select label="Crypto network / transfer system" value={activeNetwork} onChange={(e: any) => setNetwork(e.target.value)}>{CRYPTO_NETWORK_LABELS.map(n => <option key={n}>{n}</option>)}</Select>}
        <div className="relative">
          <Input label={`Amount (${currency})`} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <MaxBtn onClick={() => setAmount(String(Math.round(fromBDT(w?.available ?? 0) * 100) / 100))} />
        </div>
        {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} at today's rate.</p>}
        <Input label={destLabel} value={dest} onChange={e => setDest(e.target.value)} />
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Payment fee</span><span className="font-bold">{fmtMoney(fee)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">You will receive</span><span className="font-bold text-emerald-600">{fmtMoney(Math.max(amtBDT - fee, 0))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Speed</span><span className="font-bold text-emerald-600">⚡ Instant</span></div>
          <div className="flex justify-between"><span className="text-slate-500">PIN / password</span><span className="font-bold text-emerald-600">Not required</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Account level</span><span className="font-bold">Level 2+</span></div>
        </div>
        <WizardNav nextLabel="Review payment" onNext={() => {
          if (!amtBDT || amtBDT < 50) return toast({ kind: 'error', title: 'Minimum payment is ' + fmtMoney(50) })
          if (!dest.trim()) return toast({ kind: 'error', title: 'Enter the destination account' })
          if (user && user.level < 2) return setGate(true)
          setDwStep(1)
        }} />
        </div>
        ) : (
        <div className="space-y-4 anim-fade-up">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-bold">{fullMethod}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-bold text-right break-all">{dest}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-extrabold">{fmtMoney(amtBDT)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Fee</span><span className="font-bold">{fmtMoney(fee)}</span></div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">You will receive</span><span className="font-extrabold text-emerald-600">{fmtMoney(Math.max(amtBDT - fee, 0))}</span></div>
          </div>
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/25 p-4 text-sm"><b>⚡ Instant and final.</b> Payments are sent immediately with no PIN and no review — double-check the destination before confirming.</div>
          <StepUpField amountBdt={amtBDT} value={stepPw} onChange={setStepPw} />
          <WizardNav onBack={() => setDwStep(0)} nextLabel="Confirm — Pay now" onNext={submit} />
        </div>
        )}
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">Payment history</h3>
      {mine.length === 0 ? <Card><Empty title="No payments yet" /></Card> : (
        <div className="space-y-2">{mine.map(x => (
          <Card key={x.id} className="p-4 flex items-center gap-3"><TxDirIcon dir={txDirection(x.category, x.amount)} /><div className="flex-1"><p className="font-bold">{x.title}</p><p className="text-xs text-slate-400">{x.id} · {fmtDateTime(x.createdAt)}</p></div><div className="text-right"><p className={`font-bold ${txAmountCls(txDirection(x.category, x.amount))}`}>{txSign(txDirection(x.category, x.amount))}{fmtMoney(Math.abs(x.amount))}</p><Badge tone="green">completed</Badge></div></Card>
        ))}</div>
      )}
      <Level2GateModal open={gate} onClose={() => setGate(false)} feature="Payment" />
      <SuccessModal open={done} onClose={() => setDone(false)} title="Payment completed ⚡"
        rows={lastTx ? [['Amount', fmtMoney(lastTx?.amount ?? 0)], ['Method', lastTx?.method ?? ''], ['Speed', 'Instant'], ['Status', 'Completed']] : []} />
      <ResultModal open={!!errMsg} onClose={() => setErrMsg('')} kind="error" title="Payment failed" body={errMsg} />
    </div>
  )
}

const PLANS = [
  { days: 0, apy: 5, label: 'Flexible', note: 'Withdraw anytime' },
  { days: 30, apy: 8, label: '30 days', note: 'Short term' },
  { days: 90, apy: 12, label: '90 days', note: 'Best value' },
  { days: 180, apy: 16, label: '180 days', note: 'Max return' },
]
export function EarnPage() {
  const { user, db, earnInfo, t } = useApp()
  if (!user) return null
  const einfo = earnInfo()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const todayL = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
  const rewardOptions = [
    { to: '/earn/checkin', icon: '📅', title: 'Daily Check-in', sub: 'Up to ' + usd(50) + ' a day', badge: einfo.lastCheckin === todayL ? '✓ Claimed' : 'Claim now' },
    { to: '/earn/ads', icon: '📺', title: 'View Ads', sub: usd(2) + '–' + usd(8) + ' per ad', badge: (ADS_PER_DAY - einfo.ads) + ' left today' },
    { to: '/earn/spin', icon: '🎡', title: 'Spin Wheel', sub: 'Win up to ' + usd(50), badge: (SPINS_PER_DAY - einfo.spins) + ' spins left' },
    { to: '/earn/tasks', icon: '✅', title: 'Complete Tasks', sub: 'Simple tasks, real rewards', badge: (EARN_TASKS.length - einfo.tasksDone.length) + ' open' },
  ]
  return (
    <div>
      <PageHead title="Earn" sub="Rewards and fun ways to earn free USDT every day." />
      <h3 className="font-extrabold mb-3">{t('earn_grow')}</h3>
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <Link to="/crypto" className="block">
          <Card className="p-4 h-full hover:border-violet-400 transition text-center">
            <span className="text-2xl">₿</span>
            <p className="font-extrabold text-sm mt-1.5">{t('act_crypto')}</p>
            <p className="text-[11px] text-slate-400">{t('earn_crypto_sub')}</p>
          </Card>
        </Link>
        <Link to="/staking" className="block">
          <Card className="p-4 h-full hover:border-violet-400 transition text-center">
            <span className="text-2xl">🌱</span>
            <p className="font-extrabold text-sm mt-1.5">{t('act_staking')}</p>
            <p className="text-[11px] text-slate-400">{t('earn_staking_sub')}</p>
          </Card>
        </Link>
        <Link to="/install" className="block">
          <Card className="p-4 h-full hover:border-violet-400 transition text-center">
            <span className="text-2xl">📲</span>
            <p className="font-extrabold text-sm mt-1.5">{t('act_install')}</p>
            <p className="text-[11px] text-slate-400">{t('earn_install_sub')}</p>
            <span className="inline-block mt-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600">{user.appBonusAt ? t('install_claimed') : '$2 bonus'}</span>
          </Card>
        </Link>
      </div>
      <h3 className="font-extrabold mb-3">Rewards — earn free USDT</h3>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {rewardOptions.map(o => (
          <Link key={o.to} to={o.to} className="block">
            <Card className="p-4 h-full hover:border-violet-400 transition">
              <span className="text-2xl">{o.icon}</span>
              <p className="font-extrabold text-sm mt-1.5">{o.title}</p>
              <p className="text-[11px] text-slate-400">{o.sub}</p>
              <span className="inline-block mt-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-500/10 text-violet-600">{o.badge}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function StakingPage() {
  const { user, db, walletOf, stake, unstake, toast, addTicket, replyTicket } = useApp()
  const [amount, setAmount] = useState(''); const [plan, setPlan] = useState(1)
  const [relReq, setRelReq] = useState<any>(null); const [relMsg, setRelMsg] = useState(''); const [okModal, setOkModal] = useState<{ title: string; rows: [string, string][] } | null>(null); const [errMsg, setErrMsg] = useState('')
  if (!user) return null
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const w = walletOf(user.id)
  const availUsd = w.available / db.settings.bdtPerUsd + (w.holdings.USDT ?? 0)
  const amt = Number(amount) || 0
  const amtBDT = Math.round(amt * db.settings.bdtPerUsd)
  const myStakes = db.stakes.filter(s => s.userId === user.id)
  const accrued = (s: typeof myStakes[number]) => Math.round(s.amount * s.apy / 100 * Math.max(0, (Date.now() - new Date(s.startAt).getTime()) / 86_400_000) / 365)
  const unlockAt = (s: typeof myStakes[number]) => new Date(s.startAt).getTime() + s.termDays * 86_400_000
  const isLocked = (s: typeof myStakes[number]) => s.termDays > 0 && Date.now() < unlockAt(s)
  const fmtDay = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const openRelease = (s: typeof myStakes[number]) => {
    setRelReq(s)
    setRelMsg('Hello, please release my stake early.\\n\\nStake: ' + usd(s.amount) + ' · ' + s.apy + '% APY · ' + s.termDays + '-day plan\\nStarted: ' + fmtDay(new Date(s.startAt).getTime()) + ' · Unlocks: ' + fmtDay(unlockAt(s)) + '\\n\\nReason: ')
  }
  const sendRelease = () => {
    if (!relReq || !relMsg.trim()) return
    const open = db.tickets.find(t => t.userId === user.id && t.status !== 'resolved')
    if (open) replyTicket(open.id, relMsg.trim(), 'user')
    else addTicket('Early stake release request', relMsg.trim())
    setRelReq(null); setRelMsg('')
    toast({ kind: 'success', title: 'Request sent to Support', body: 'Support can release this stake early from your account. You will be notified when they reply.' })
  }
  const totalStaked = myStakes.filter(s => s.status === 'active').reduce((a, s) => a + s.amount, 0)
  const totalEarned = myStakes.filter(s => s.status === 'active').reduce((a, s) => a + accrued(s), 0)
  const submit = async () => {
    if (!amt || amt < 1) return toast({ kind: 'error', title: 'Minimum stake is $1.00' })
    const err = await stake(amtBDT, PLANS[plan].apy, PLANS[plan].days)
    if (err) return setErrMsg(err)
    setAmount(''); setOkModal({ title: 'Staked successfully ✓', rows: [['Amount', fmtUSDT(amt)], ['Plan', PLANS[plan].label + ' · ' + PLANS[plan].apy + '% APY'], ['Status', 'Active — earning daily']] })
  }
  return (
    <div>
      <PageHead title="Staking" sub="Stake USDT and earn daily interest. Unstake anytime (flexible) or at term." />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Available</p><p className="font-extrabold mt-1">{fmtUSDT(availUsd)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Staked</p><p className="font-extrabold mt-1 text-violet-600">{usd(totalStaked)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Earned</p><p className="font-extrabold mt-1 text-emerald-500">{usd(totalEarned)}</p></Card>
      </div>
      <Card className="p-5 space-y-4">
        <h3 className="font-extrabold">Choose a plan</h3>
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map((p, i) => (
            <button key={p.label} onClick={() => setPlan(i)} className={`rounded-2xl border-2 p-3.5 text-left ${plan === i ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
              <p className="font-extrabold text-lg text-violet-600">{p.apy}% <span className="text-xs">APY</span></p>
              <p className="font-bold text-sm">{p.label}</p><p className="text-[11px] text-slate-400">{p.note}</p>
            </button>
          ))}
        </div>
        <Input label="Amount (USDT)" type="number" placeholder="e.g. 100" value={amount} onChange={e => setAmount(e.target.value)} />
        {amt > 0 && <p className="text-xs text-slate-500">Projected yearly earning: <b className="text-emerald-600">{fmtUSDT(amt * PLANS[plan].apy / 100)}</b></p>}
        {PLANS[plan].days > 0 && <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">🔒 This is a fixed-term plan — it locks until {fmtDay(Date.now() + PLANS[plan].days * 86_400_000)}. Only the Flexible plan can be unstaked anytime; early release is possible via Support.</p>}
        <Btn className="w-full py-3.5" onClick={submit}>Stake now</Btn>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">My stakes</h3>
      {myStakes.length === 0 ? <Card><Empty title="No stakes yet" body="Pick a plan above to start earning." /></Card> : (
        <div className="space-y-2">{myStakes.map(s => (
          <Card key={s.id} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1"><p className="font-bold">{usd(s.amount)} · {s.apy}% APY</p>
                <p className="text-xs text-slate-400">{s.termDays === 0 ? 'Flexible' : s.termDays + ' days'} · started {fmtDateTime(s.startAt)} · earned so far <b className="text-emerald-500">{usd(accrued(s))}</b></p></div>
              {s.status !== 'active' ? <Badge tone="slate">closed</Badge>
                : isLocked(s)
                  ? <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400">🔒 Locked until {fmtDay(unlockAt(s))}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{Math.ceil((unlockAt(s) - Date.now()) / 86_400_000)} days left</span>
                      <Btn variant="outline" className="!py-2 !text-xs" onClick={() => openRelease(s)}>Request early release</Btn>
                    </div>
                  : <Btn variant="outline" className="!py-2 !text-xs" onClick={async () => { const back = s.amount + accrued(s); const e = await unstake(s.id); if (e) setErrMsg(e); else setOkModal({ title: 'Unstaked ✓', rows: [['Returned to balance', usd(back)], ['Principal', usd(s.amount)], ['Interest earned', usd(accrued(s))], ['Status', 'Completed']] }) }}>Unstake</Btn>}
            </div>
          </Card>
        ))}</div>
      )}
      <SuccessModal open={!!okModal} onClose={() => setOkModal(null)} title={okModal?.title ?? ''} rows={okModal?.rows ?? []} />
      <ResultModal open={!!errMsg} onClose={() => setErrMsg('')} kind="error" title="That didn't work" body={errMsg} />
      <Modal open={!!relReq} onClose={() => setRelReq(null)} title="Request early release">
        {relReq && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed">This <b>{relReq.termDays}-day plan</b> is locked until <b>{fmtDay(unlockAt(relReq))}</b> — fixed-term stakes can't be unstaked early by yourself. If you need the money sooner, message Support below and an admin can release it for you.</p>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5 text-sm flex justify-between gap-3"><span className="font-semibold">Stake</span><b>{usd(relReq.amount)} · {relReq.apy}% APY</b></div>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Message to Support</span>
              <textarea value={relMsg} onChange={e => setRelMsg(e.target.value)} rows={6} className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            </label>
            <Btn className="w-full py-3.5" disabled={!relMsg.trim()} onClick={sendRelease}>Send to Support</Btn>
            <p className="text-[11px] text-slate-400 text-center">Goes to your Support chat — replies arrive there and as a notification.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function SwapPage() {
  const { user, db, walletOf, swap, toast } = useApp()
  const { coins } = useMarket()
  const [from, setFrom] = useState('USDT'); const [to, setTo] = useState('BTC'); const [amount, setAmount] = useState(''); const [receiveAmt, setReceiveAmt] = useState(''); const [okModal, setOkModal] = useState<{ title: string; rows: [string, string][] } | null>(null); const [errMsg, setErrMsg] = useState('')
  if (!user) return null
  const w = walletOf(user.id)
  const prices = useMemo(() => Object.fromEntries(coins.map(c => [c.symbol, c.priceUsd])), [coins])
  const priceOf = (sym: string) => sym === 'USDT' ? 1 : (prices[sym] ?? 0)
  const amt = Number(amount) || 0
  const usdGross = amt * priceOf(from)
  const dpOf = (sym: string) => sym === 'USDT' ? 2 : 6
  const fmtIn = (v: number, sym: string) => String(Math.round(v * 10 ** dpOf(sym)) / 10 ** dpOf(sym))
  const onFromAmt = (v: string) => { setAmount(v); const a = Number(v) || 0; setReceiveAmt(v && priceOf(to) ? fmtIn(a * priceOf(from) * 0.995 / priceOf(to), to) : '') }
  const onReceiveAmt = (v: string) => { setReceiveAmt(v); const r = Number(v) || 0; setAmount(v && priceOf(from) ? fmtIn(r * priceOf(to) / 0.995 / priceOf(from), from) : '') }
  const spendableUSDT = (w.holdings.USDT ?? 0) + w.available / db.settings.bdtPerUsd
  const balanceOf = (sym: string) => sym === 'BDT' ? w.available : sym === 'USDT' ? spendableUSDT : (w.holdings[sym] ?? 0)
  const assets = ['USDT', ...Object.keys(COIN_META).filter(s => s !== 'USDT')]
  const fmtAmt = (sym: string, v: number) => sym === 'USDT' ? v.toFixed(2) + ' USDT' : v.toFixed(6) + ' ' + sym
  const submit = async () => {
    if (!amt) return toast({ kind: 'error', title: 'Enter an amount' })
    const err = await swap(from, to, amt, prices)
    if (err) return setErrMsg(err)
    setOkModal({ title: 'Swap completed ✓', rows: [['You swapped', fmtAmt(from, amt)], ['You receive (approx.)', fmtAmt(to, Number(receiveAmt) || 0)], ['Swap fee (0.5%)', fmtUSDT(usdGross * 0.005)], ['Status', 'Completed']] })
    setAmount(''); setReceiveAmt('')
  }
  return (
    <div>
      <PageHead title="Swap" sub="Instantly exchange USDT and crypto at live prices · 0.5% swap fee." />
      <Card className="p-5 space-y-4">
        <div>
          <Select label="From" value={from} onChange={(e: any) => { setFrom(e.target.value); if (e.target.value === to) setTo(from); setAmount(''); setReceiveAmt('') }}>{assets.map(a => <option key={a} value={a}>{a} — balance {fmtAmt(a, balanceOf(a))}</option>)}</Select>
          <div className="relative">
            <Input className="mt-3" type="number" placeholder="0.00" value={amount} onChange={e => onFromAmt(e.target.value)} />
            <MaxBtn onClick={() => onFromAmt(fmtIn(balanceOf(from), from))} />
          </div>
          {from === 'USDT' && w.available > 0 && <p className="text-[11px] text-slate-400 mt-1.5">Includes {fmtUSDT(w.available / db.settings.bdtPerUsd)} from your added-money balance — it converts automatically when you swap.</p>}
        </div>
        <div className="flex justify-center">
          <button onClick={() => { setFrom(to); setTo(from); setAmount(''); setReceiveAmt('') }} className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition" aria-label="Flip pair"><ArrowLeftRight size={19} /></button>
        </div>
        <div>
          <Select label="To" value={to} onChange={(e: any) => { setTo(e.target.value); if (e.target.value === from) setFrom(to); setAmount(''); setReceiveAmt('') }}>{assets.map(a => <option key={a} value={a}>{a} — balance {fmtAmt(a, balanceOf(a))}</option>)}</Select>
          <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4">
            <p className="text-xs text-slate-400 font-bold">YOU RECEIVE (EST.)</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <input value={receiveAmt} onChange={e => onReceiveAmt(e.target.value)} type="number" placeholder="0.00" className="w-full min-w-0 bg-transparent text-2xl font-extrabold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              <span className="font-extrabold text-slate-400 shrink-0">{to}</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Rate</span><span className="font-bold">1 {from} ≈ {priceOf(to) ? (priceOf(from) / priceOf(to)).toPrecision(4) : '—'} {to}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Swap fee (0.5%)</span><span className="font-bold">{fmtUSDT(usdGross * 0.005)}</span></div>
        </div>
        <Btn className="w-full py-3.5" onClick={submit}>Swap now</Btn>
      </Card>
      <SuccessModal open={!!okModal} onClose={() => setOkModal(null)} title={okModal?.title ?? ''} rows={okModal?.rows ?? []} />
      <ResultModal open={!!errMsg} onClose={() => setErrMsg('')} kind="error" title="Swap failed" body={errMsg} />
    </div>
  )
}

/** Cards — the owner's main-nav section (2026-11-23), between Transactions
 * and News. Design + wishlist rules are the owner's (2026-11-23): the logo
 * sits tile-less on the card, the chip carries SIM-style contact lines,
 * there is no "Card holder" label (the name alone), and tapping the card
 * flips it to a realistic back (magnetic stripe, signature strip, masked
 * CVV ***, website + support email, fine print). "Notify me" is a real
 * server wishlist: KYC-verified accounts only — anyone else gets the
 * verify-first toast — and joining sends the user a confirmation email
 * and lists them in Admin → Users → Cards Wishlist. */
export function CardsPage() {
  const { user, t, toast, joinCardWishlist } = useApp()
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const chipId = useId().replace(/[^a-zA-Z0-9]/g, '')
  if (!user) return null
  const joined = !!user.cardWishlistJoined
  const notify = async () => {
    if (user.kyc !== 'verified') return toast({ kind: 'error', title: t('cards_verify_first'), body: t('cards_verify_body') })
    setBusy(true)
    const err = await joinCardWishlist()
    setBusy(false)
    if (err === 'kyc_required') return toast({ kind: 'error', title: t('cards_verify_first'), body: t('cards_verify_body') })
    if (err) return toast({ kind: 'error', title: err })
    toast({ kind: 'success', title: t('cards_notified') })
  }
  return (
    <div>
      <PageHead title={t('nav_cards')} sub={t('cards_soon_title')} />
      <div className="max-w-md space-y-5">
        <div>
          <div className="@container [perspective:1400px] cursor-pointer select-none" onClick={() => setFlipped(f => !f)} role="button" aria-label={t('cards_flip_hint')}>
            <div className={`relative aspect-[8/5] transition-transform duration-700 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
              <div className="absolute inset-0 [backface-visibility:hidden] overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 text-white shadow-2xl shadow-violet-600/30">
                <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10" />
                <div className="absolute -bottom-24 -left-10 w-56 h-56 rounded-full bg-black/10" />
                <div className="relative p-5 sm:p-6 h-full flex flex-col">
                  <div className="flex items-start justify-between">
                    <LogoMark size={44} />
                    <span className="text-[11px] font-extrabold tracking-[0.25em] uppercase bg-white/20 rounded-full px-3 py-1.5">{t('cards_virtual')}</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <svg width="46" height="34" viewBox="0 0 46 34" aria-hidden="true">
                      <defs><linearGradient id={'nwchip' + chipId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#f59e0b" /></linearGradient></defs>
                      <rect x="0.6" y="0.6" width="44.8" height="32.8" rx="5" fill={`url(#nwchip${chipId})`} stroke="#92400e" strokeOpacity="0.45" />
                      <path d="M1 12 H15 M1 22 H15 M45 12 H31 M45 22 H31 M15 7 V27 M31 7 V27" stroke="#92400e" strokeOpacity="0.55" strokeWidth="1.1" fill="none" />
                      <rect x="15" y="12" width="16" height="10" rx="2" fill="none" stroke="#92400e" strokeOpacity="0.55" strokeWidth="1.1" />
                    </svg>
                    <Nfc size={22} className="opacity-80" />
                  </div>
                  <p className="mt-3 flex justify-between font-mono text-[13px] sm:text-sm">{(user.novaAddress ?? '').match(/.{1,4}/g)?.map((g, i) => <span key={i}>{g}</span>)}</p>
                  <div className="mt-auto flex items-end justify-between gap-3">
                    <p className="font-bold uppercase truncate text-sm">{user.name}</p>
                    <span className="font-extrabold text-xl tracking-tight text-white drop-shadow-md shrink-0">Nova<span className="text-violet-500">Wallet</span></span>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-800 via-indigo-950 to-violet-900 text-white shadow-2xl shadow-violet-600/30">
                <div className="h-[8.5cqw] mt-[4cqw] bg-neutral-900" />
                <div className="px-[6cqw] pt-[3cqw]">
                  <p className="text-[2.4cqw] uppercase tracking-[0.2em] text-white/60">Authorized signature — not valid unless signed</p>
                  <div className="mt-[1.6cqw] flex items-stretch gap-[2cqw]">
                    <div className="flex-1 bg-slate-100 rounded h-[8.5cqw]" />
                    <div className="bg-white text-slate-900 rounded px-[2.5cqw] py-[1cqw] text-center shrink-0"><span className="block text-[2.1cqw] font-extrabold tracking-widest text-slate-500">CVV</span><span className="block font-mono font-bold leading-none text-[3.6cqw]">***</span></div>
                  </div>
                  <div className="mt-[2.6cqw] space-y-0 text-[2.7cqw] leading-[1.3] text-white/85 font-semibold">
                    <p>www.novawallet.pp.ua</p>
                    <p>support@novawallet.pp.ua</p>
                  </div>
                  <div className="mt-[2cqw] flex items-end gap-[3cqw]">
                    <p className="flex-1 text-[2.2cqw] leading-[1.4] text-white/50">This is a preview of the NovaWallet virtual card. The card remains the property of NovaWallet and may only be used by the named holder, subject to the NovaWallet terms. Questions about this card? Contact us at the email above.</p>
                    <span className="shrink-0 block w-[6.5cqw]"><LogoMark size={24} className="block w-full h-auto" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2.5">{t('cards_flip_hint')}</p>
        </div>
        <Card className="p-6 space-y-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2.5 flex-wrap"><span className="text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white rounded-full px-2.5 py-1 shadow-lg shadow-emerald-500/40">{t('cards_free')}</span>{t('cards_soon_title')}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{t('cards_soon_body')}</p>
          <ul className="space-y-3 text-sm font-semibold">
            <li className="flex items-center gap-3"><span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300"><Sparkles size={16} /></span>{t('cards_feat_issuance')}</li>
            <li className="flex items-center gap-3"><span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300"><Coins size={16} /></span>{t('cards_feat_cashback')}</li>
            <li className="flex items-center gap-3"><span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300"><Globe size={16} /></span>{t('cards_feat_online')}</li>
            <li className="flex items-center gap-3"><span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300"><Snowflake size={16} /></span>{t('cards_feat_freeze')}</li>
            <li className="flex items-center gap-3"><span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300"><BadgePercent size={16} /></span>{t('cards_feat_fee')}</li>
          </ul>
          <Btn className="w-full" disabled={joined || busy} onClick={notify}>{joined ? '✓ ' + t('cards_notified') : busy ? '…' : t('cards_notify')}</Btn>
        </Card>
      </div>
    </div>
  )
}

export function InstallPage() {
  const { user, appInstalled, claimAppBonus, toast, t } = useApp()
  const [claiming, setClaiming] = useState(false)
  useEffect(() => {
    const done = () => toast({ kind: 'success', title: t('install_done'), body: t('install_open_hint') })
    window.addEventListener('appinstalled', done)
    return () => window.removeEventListener('appinstalled', done)
  }, [])
  if (!user) return null
  const claimed = !!user.appBonusAt
  const install = async () => {
    const r = await promptInstall()
    if (r === 'unavailable') toast({ kind: 'info', title: t('install_unavailable') })
  }
  const claim = async () => { setClaiming(true); await claimAppBonus(); setClaiming(false) }
  const stepDot = "shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 text-xs font-extrabold flex items-center justify-center"
  return (
    <div>
      <PageHead title={t('act_install')} sub={t('install_body')} />
      <Card className="p-6 text-center">
        <span className="inline-block rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-800 p-2 shadow-lg shadow-violet-700/30"><LogoMark size={52} /></span>
        <p className="font-extrabold text-lg mt-3">{t('install_title')}</p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{t('install_body')}</p>
        <p className="mt-3 inline-block text-xs font-extrabold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600">🎁 $2 bonus</p>
        {claimed ? (
          <div className="mt-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 font-extrabold py-3.5 px-4">✓ {t('install_claimed')}</div>
        ) : appInstalled ? (
          <div>
            <p className="mt-4 text-sm font-bold text-emerald-600">{t('install_done')}</p>
            <Btn className="w-full py-3.5 mt-3" disabled={claiming} onClick={claim}>{claiming ? '…' : t('install_claim')}</Btn>
          </div>
        ) : (
          <Btn className="w-full py-3.5 mt-5" onClick={install}>⬇ {t('install_now')}</Btn>
        )}
      </Card>
      {!appInstalled && (
        <Card className="p-5 mt-4">
          <h3 className="font-extrabold mb-3">How to install</h3>
          <ol className="space-y-3.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="flex gap-2.5"><span className={stepDot}>1</span><span><b>Android (Chrome):</b> {t('install_how')}</span></li>
            <li className="flex gap-2.5"><span className={stepDot}>2</span><span><b>iPhone (Safari):</b> {t('install_ios')}</span></li>
            <li className="flex gap-2.5"><span className={stepDot}>3</span><span>{t('install_open_hint')}</span></li>
          </ol>
        </Card>
      )}
    </div>
  )
}
