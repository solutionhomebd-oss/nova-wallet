import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Bell, Check, CheckCheck, Copy, Download, LayoutDashboard, Megaphone, Menu, MessageCircle, Search, Send, Lock, Pause, Play, RotateCcw, Settings as SettingsIcon, ShieldCheck, Wallet, X, HandCoins, Gift, ScrollText, Loader2, Mail, Tag, History, AlertTriangle, Smartphone, Trash2 } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../lib/store'
import { apiGet, apiPost } from '../lib/api'
import { Avatar, Badge, Btn, Card, Empty, Input, Modal, Select, TxDirIcon, statusTone } from '../components/ui'
import LogoLoader, { PageLoader } from '../components/LogoLoader'
import { fmtDateTime, fmtPrice, fmtUSDT, txAmountCls, txDirection, txSign } from '../lib/utils'
import { COIN_META, useMarket } from '../lib/market'
import { CRYPTO_NETWORK_LABELS } from '../lib/localPayments'
import type { AutoChecks, PayMethod } from '../lib/types'

import { TABS, SCOPE_TABS, AdminMenuNav } from '../components/AdminShell'


/** AI auto-check verdicts (flag-only): the server reads the document and
    compares faces after each KYC submission / loan application. The admin
    still decides — these chips just put the evidence in front of them. */
function AutoCheckChips({ c, loan }: { c?: AutoChecks; loan?: boolean }) {
  if (!c) return <p className="text-[11px] text-slate-400 mt-2">🤖 AI auto-check pending…</p>
  if (c.error) return <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-2">🤖 AI check unavailable — review the documents manually</p>
  const tone = (t: 'good' | 'bad' | 'warn' | 'flat') => t === 'good'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    : t === 'bad' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
    : t === 'warn' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    : 'bg-slate-200/70 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
  const chip = (t: 'good' | 'bad' | 'warn' | 'flat', text: string, key: number) => <span key={key} className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tone(t)}`}>{text}</span>
  const items: [ 'good' | 'bad' | 'warn' | 'flat', string ][] = []
  if (loan) {
    if (c.kycVerified === false) items.push(['warn', 'No verified KYC'])
    if (c.kycNumberMatch) items.push([c.kycNumberMatch === 'match' ? 'good' : 'bad', c.kycNumberMatch === 'match' ? 'NID ✓ matches verified KYC' : 'NID ⚠ differs from verified KYC'])
  }
  if (c.numberMatch) items.push([c.numberMatch === 'match' ? 'good' : c.numberMatch === 'mismatch' ? 'bad' : 'flat', 'Number ' + (c.numberMatch === 'match' ? '✓ matches' : c.numberMatch === 'mismatch' ? '⚠ differs from document' : '— unread')])
  if (c.nameMatch) items.push([c.nameMatch === 'match' ? 'good' : c.nameMatch === 'partial' ? 'warn' : c.nameMatch === 'mismatch' ? 'bad' : 'flat', 'Name ' + (c.nameMatch === 'match' ? '✓ matches' : c.nameMatch === 'partial' ? '~ partly matches' : c.nameMatch === 'mismatch' ? '⚠ differs from document' : '— unread')])
  if (c.faceMatch) items.push([c.faceMatch === 'match' ? 'good' : c.faceMatch === 'mismatch' ? 'bad' : 'warn', 'Face ' + (c.faceMatch === 'match' ? '✓ consistent' : c.faceMatch === 'mismatch' ? '⚠ different person' : c.faceMatch === 'no_face' ? '— no clear face' : '~ uncertain')])
  if (c.docGenuine) items.push([c.docGenuine === 'yes' ? 'good' : c.docGenuine === 'no' ? 'bad' : 'flat', c.docGenuine === 'yes' ? 'Document ✓ looks genuine' : c.docGenuine === 'no' ? 'Document ⚠ may not be an ID' : 'Document — unclear'])
  return (
    <div className="mt-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mr-0.5">🤖 AI check</span>
        {items.map(([t, text], i) => chip(t, text, i))}
      </div>
      {(c.extractedName || c.extractedNumber) && <p className="text-[11px] text-slate-400 mt-1">Document reads: <b className="text-slate-500 dark:text-slate-300">{c.extractedName || '—'}</b> · <span className="font-mono">{c.extractedNumber || '—'}</span></p>}
      {c.faceDoc && <p className="text-[11px] text-slate-400 mt-0.5">Face on document: {c.faceDoc} · Selfie: {c.faceSelfie}</p>}
      {c.faceNote && <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">⚠ {c.faceNote}</p>}
    </div>
  )
}

export default function Admin() {
  const { user, db, decideDeposit, decideWithdraw, decideLoan, setLoanFee, confirmLoanFee, decideKyc, stepUp, txHold, txUnhold, txCancel, publishNews, deleteNews, updateSettings, toggleBanner, saveBanner, deleteBanner, moveBanner, toast, resetDemo, decideUpgrade, updateLevelDef, setUserLevel, markRead, markAllRead, broadcast, adminErrors } = useApp()
  const usdt = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const byDateDesc = <T extends { createdAt: string }>(arr: T[]): T[] => [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  useMarket(30_000)
  const navigate = useNavigate()
  const [tab, setTab] = useState<string>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  // Users ▸ KYC Verification submenu (sidebar/drawer) + the user a KYC
  // badge click wants highlighted once the KYC tab opens.
  const [kycFocus, setKycFocus] = useState<string | null>(null)
  useEffect(() => {
    if (tab !== 'kyc' || !kycFocus) return
    const t = setTimeout(() => document.getElementById('kyc-card-' + kycFocus)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    return () => clearTimeout(t)
  }, [tab, kycFocus])
  // RBAC: a scoped admin only sees their tabs (the server enforces too).
  const myScope = user?.adminScope ?? 'full'
  const visibleTabs = TABS.filter(t => myScope === 'full' || (SCOPE_TABS[myScope] ?? []).includes(t.id))
  // System submenu (sidebar/drawer): Audit Log, Reports & Export, System Health.
  useEffect(() => { if (!visibleTabs.some(t => t.id === tab)) setTab('overview') }, [tab, myScope])
  // Phase 3 UI state: feature switches, broadcast composer, global
  // search and the System Health API probe.
  const [feat, setFeat] = useState<any>(null)
  useEffect(() => { if (tab === 'features' && feat === null) setFeat({ deposits: true, withdrawals: true, trading: true, loans: true, registration: true, ...(db.settings.features ?? {}) }) }, [tab, feat, db.settings.features])
  const [bcTitle, setBcTitle] = useState(''); const [bcBody, setBcBody] = useState(''); const [bcBusy, setBcBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false); const [searchQ, setSearchQ] = useState('')
  const [apiHealth, setApiHealth] = useState<any>(null)
  useEffect(() => { if (tab !== 'health') return; setApiHealth(null); apiGet('/health').then(r => setApiHealth(r)).catch(() => setApiHealth({ ok: false })) }, [tab])
  const [emailLog, setEmailLog] = useState<any[] | null>(null)
  const [testMailBusy, setTestMailBusy] = useState(false)
  const loadEmailLog = () => { apiGet('/v1/admin/overview').then(r => setEmailLog(r?.overview?.emailLog ?? [])).catch(() => setEmailLog([])) }
  useEffect(() => { if (tab === 'emaillog') { setEmailLog(null); loadEmailLog() } }, [tab])
  const sendTestMail = async () => {
    if (testMailBusy) return
    setTestMailBusy(true)
    try { await apiPost('/v1/admin/test-email', {}); toast({ kind: 'success', title: 'Test email sent', body: 'Check your inbox — delivery is working.' }); loadEmailLog() }
    catch (e: any) { toast({ kind: 'error', title: e.message || 'Test email failed' }) }
    finally { setTestMailBusy(false) }
  }
  const downloadCsv = (name: string, rows: Record<string, any>[]) => {
    if (!rows.length) return toast({ kind: 'error', title: 'Nothing to export yet' })
    const keys = Object.keys(rows[0])
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => '"' + String(r[k] ?? '').replace(/"/g, '""') + '"').join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  }
  const [notifOpen, setNotifOpen] = useState(false)
  const [userQ, setUserQ] = useState('')
  const [txQ, setTxQ] = useState(''); const [selTxId, setSelTxId] = useState<string | null>(null); const [txCancelArm, setTxCancelArm] = useState(false)
  const copyTxId = async (id: string) => { try { await navigator.clipboard.writeText(id); toast({ kind: 'success', title: 'Transaction ID copied', body: id }) } catch { toast({ kind: 'error', title: 'Copy failed', body: id }) } }
  const txq = txQ.trim().toLowerCase()
  const filteredTxs = !txq ? byDateDesc(db.txs) : byDateDesc(db.txs).filter(tx => tx.id.toLowerCase().includes(txq) || tx.title.toLowerCase().includes(txq) || (tx.counterparty ?? '').toLowerCase().includes(txq) || (db.users.find(u => u.id === tx.userId)?.name.toLowerCase().includes(txq) ?? false))
  // User details now live on their own page (same pattern as the chat).
  const openUser = (u: any) => navigate('/admin/users/' + u.id)
  const selTx = selTxId ? db.txs.find(t => t.id === selTxId) ?? null : null
  useEffect(() => { setTxCancelArm(false) }, [selTxId])
  // KYC photos live on the server (too heavy for the directory sync) —
  // the KYC Verification tab fetches them on demand per submission.
  const [kycPhotos, setKycPhotos] = useState<Record<string, { docPhoto?: string; facePhoto?: string } | 'loading'>>({})
  const [kycStepUpFor, setKycStepUpFor] = useState<any>(null)
  const [kycStepPw, setKycStepPw] = useState('')
  const [kycStepBusy, setKycStepBusy] = useState(false)
  const [manualFor, setManualFor] = useState<any>(null)
  const [manualReason, setManualReason] = useState('')
  const [manualBusy, setManualBusy] = useState(false)
  const loadKycPhotos = (u: any) => {
    if (kycPhotos[u.id]) return
    setKycPhotos(m => ({ ...m, [u.id]: 'loading' }))
    const uid = u.fbUid ?? u.id
    apiGet('/v1/admin/kyc/' + uid).then(r => setKycPhotos(m => ({ ...m, [u.id]: { docPhoto: r?.kyc?.docPhoto ?? u.kycDocPhoto, facePhoto: r?.kyc?.facePhoto ?? u.kycFacePhoto } }))).catch((e: any) => {
      if (String(e?.message || '').includes('step_up_required')) {
        // Identity documents need a fresh password check first (step-up);
        // ask for the password, then retry. The view itself is audit-logged.
        setKycPhotos(m => { const n = { ...m }; delete n[u.id]; return n })
        setKycStepPw(''); setKycStepUpFor(u)
        return
      }
      setKycPhotos(m => ({ ...m, [u.id]: { docPhoto: u.kycDocPhoto, facePhoto: u.kycFacePhoto } }))
    })
  }
  const submitKycStepUp = async () => {
    if (!kycStepUpFor || !kycStepPw) return
    setKycStepBusy(true)
    const err = await stepUp(kycStepPw)
    setKycStepBusy(false)
    if (err) return toast({ kind: 'error', title: 'Password check failed', body: err })
    const u = kycStepUpFor; setKycStepUpFor(null); setKycStepPw('')
    loadKycPhotos(u)
  }
  const submitManualVerify = async () => {
    if (!manualFor) return
    if (!manualReason.trim()) return toast({ kind: 'error', title: 'A reason is required', body: 'Manual verification without documents must say why — it is written to the audit log.' })
    setManualBusy(true)
    const err = await decideKyc(manualFor.id, true, manualReason.trim())
    setManualBusy(false)
    if (err) return toast({ kind: 'error', title: 'Manual verification failed', body: err })
    setManualFor(null); setManualReason('')
    toast({ kind: 'success', title: 'Verified manually — reason saved to the audit log' })
  }
  // Deep links from notifications: /admin?tab=finance|loans|levels|users|support — and
  // ?user=<id> opens that customer's Manage modal straight away (KYC / new-user alerts).
  useEffect(() => {
    let q: URLSearchParams
    try { q = new URLSearchParams(window.location.search) } catch { return }
    const t = q.get('tab') === 'content' ? 'news' : q.get('tab') === 'finance' ? 'deposits' : q.get('tab')
    if (t && TABS.some(x => x.id === t)) setTab(t)
    if (q.get('search')) setSearchOpen(true)
    const uidParam = q.get('user')
    if (uidParam) { navigate('/admin/users/' + uidParam); return }
    const txParam = q.get('tx')
    if (txParam) setSelTxId(txParam)
    const kycFocusParam = q.get('kycfocus')
    if (kycFocusParam) setKycFocus(kycFocusParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pendingLevels = db.levelRequests.filter(r => r.status === 'pending').length
  const [newsForm, setNewsForm] = useState<any>(null)
  const [bannerForm, setBannerForm] = useState<any>(null)
  const [setForm, setSetForm] = useState({ ...db.settings })
  const [pmList, setPmList] = useState<PayMethod[] | null>(null)
  useEffect(() => { if (tab === 'payments' && pmList === null) setPmList(db.settings.payMethods.map(m => ({ ...m }))) }, [tab, pmList, db.settings.payMethods])
  const [pmEdit, setPmEdit] = useState<{ idx: number | null; draft: PayMethod } | null>(null)
  const [pmDel, setPmDel] = useState<PayMethod | null>(null)
  const savePm = () => {
    if (!pmEdit || !pmList) return
    const d = pmEdit.draft
    if (!d.label.trim()) return toast({ kind: 'error', title: d.kind === 'crypto' ? 'Enter the coin / asset' : 'Enter the bank name' })
    const dup = pmList.some((m, j) => j !== pmEdit.idx && m.kind === d.kind && (m.label ?? '').trim().toLowerCase() === d.label.trim().toLowerCase() && (d.kind === 'bank' ? ((d.accountNumber ?? '') !== '' && (m.accountNumber ?? '') === (d.accountNumber ?? '')) : (m.network ?? '') === (d.network ?? '')))
    if (dup) return toast({ kind: 'error', title: 'Already added', body: 'This payment method is already in the list.' })
    const next = pmEdit.idx === null ? [...pmList, d] : pmList.map((m, j) => j === pmEdit.idx ? d : m)
    setPmList(next); updateSettings({ payMethods: next }); setPmEdit(null)
    toast({ kind: 'success', title: 'Payment method saved', body: 'Add Money now shows the updated list.' })
  }
  const deletePm = () => {
    if (!pmDel || !pmList) return
    const next = pmList.filter(m => m.id !== pmDel.id)
    setPmList(next); updateSettings({ payMethods: next }); setPmDel(null)
    toast({ kind: 'success', title: 'Payment method removed', body: 'Customers no longer see it in Add Money.' })
  }
  const [levelForms, setLevelForms] = useState<Record<number, any>>({})
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({})

  const stats = useMemo(() => {
    const plain = db.users.filter(u => u.role === 'user')
    return {
      users: plain.length, active: plain.filter(u => u.status === 'active').length,
      totalBalance: db.wallets.reduce((s, w) => s + w.available + w.locked, 0),
      deposits: db.deposits.filter(d => d.status === 'approved').reduce((s, d) => s + d.amount, 0),
      withdrawals: db.withdrawals.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount, 0),
      transfers: db.txs.filter(t => t.category === 'send' && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
      fees: db.txs.reduce((s, t) => s + (t.status === 'completed' ? t.fee : 0), 0),
      refPaid: db.referralEarnings.reduce((sum, r) => sum + Math.round(r.amount / db.settings.bdtPerUsd * 100) / 100 * db.settings.bdtPerUsd, 0),
      pendingDeposits: db.deposits.filter(d => d.status === 'pending'),
      pendingWithdrawals: db.withdrawals.filter(d => d.status === 'pending'),
      pendingLoans: db.loans.filter(d => d.status === 'pending'),
      pendingKyc: db.users.filter(u => u.kyc === 'pending'),
    }
  }, [db])
  const tabBadges: Record<string, number> = {
    deposits: stats.pendingDeposits.length,
    withdrawals: stats.pendingWithdrawals.length,
    kyc: stats.pendingKyc.length,
    loans: stats.pendingLoans.length,
    levels: pendingLevels,
    support: db.tickets.filter(t => t.status === 'pending').length,
  }
  const chartData = useMemo(() => {
    const days: Record<string, { ts: number; volume: number }> = {}
    db.txs.forEach(t => { if (t.status !== 'completed') return; const d = new Date(t.createdAt); const k = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); days[k] = days[k] ?? { ts: dayTs, volume: 0 }; days[k].volume += t.amount })
    return Object.entries(days).sort((a, b) => a[1].ts - b[1].ts).slice(-7).map(([name, v]) => ({ name, volume: v.volume }))
  }, [db.txs])
  const myNotifs = byDateDesc(db.notifications.filter(n => n.userId === user?.id))
  const myUnread = myNotifs.filter(n => !n.read).length
  const openNotif = (n: typeof myNotifs[number]) => {
    markRead(n.id); setNotifOpen(false)
    const link = n.link ?? ''
    const tabM = link.match(/tab=([a-z]+)/); const userM = link.match(/user=([A-Za-z0-9-]+)/)
    const kindTab: Record<string, string> = { support: 'support', deposit: 'deposits', withdraw: 'withdrawals', loan: 'loans', kyc: 'kyc', upgrade: 'levels' }
    const rawTarget = tabM?.[1] ?? kindTab[n.kind] ?? 'overview'
    const target = rawTarget === 'content' ? 'news' : rawTarget === 'finance' ? 'deposits' : rawTarget
    if (TABS.some(x => x.id === target)) setTab(target)
    if (userM) { const du = db.users.find(x => x.id === userM[1]); if (du) openUser(du) }
  }
  if (!user) return null
  const nameOf = (id: string) => db.users.find(u => u.id === id)?.name ?? id

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 lg:hidden"><Menu size={18} /></button>
          <h1 className="font-extrabold text-lg flex items-center gap-2"><ShieldCheck className="text-amber-500" /> Admin Panel</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Search size={18} /></button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Bell size={18} />{myUnread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center justify-center">{myUnread}</span>}</button>
            <Link to="/" aria-label="Back to user app" title="Back to user app" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={18} /></Link>
          </div>
        </div>
      </header>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search everything">
        {(() => {
          const sq = searchQ.trim().toLowerCase()
          const sUsers = sq ? db.users.filter(u => (u.name + ' ' + u.email + ' ' + u.username + ' ' + u.id).toLowerCase().includes(sq)).slice(0, 5) : []
          const sTxs = sq ? db.txs.filter(t => (t.id + ' ' + t.title + ' ' + (t.method ?? '') + ' ' + (t.counterparty ?? '')).toLowerCase().includes(sq)).slice(0, 5) : []
          return (
            <div className="space-y-4">
              <Input placeholder="Name, email, username, transaction ID…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              {sq && sUsers.length === 0 && sTxs.length === 0 && <Empty title="No matches" body="Try a name, an email or a transaction ID like TXN-…" />}
              {sUsers.length > 0 && <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">Users</p>
                <div className="space-y-1.5">{sUsers.map(u => (
                  <button key={u.id} onClick={() => { setSearchOpen(false); setSearchQ(''); openUser(u) }} className="w-full flex items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3 text-left hover:border-violet-300 transition">
                    <Avatar name={u.name} photo={u.photo} />
                    <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{u.name}</span><span className="block text-xs text-slate-400 truncate">{u.email} · @{u.username}</span></span>
                    <Badge tone={u.role === 'admin' ? 'amber' : 'slate'}>{u.role === 'admin' ? 'Admin' : 'Level ' + u.level}</Badge>
                  </button>
                ))}</div>
              </div>}
              {sTxs.length > 0 && <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">Transactions</p>
                <div className="space-y-1.5">{sTxs.map(t => (
                  <button key={t.id} onClick={() => { setSearchOpen(false); setSearchQ(''); setSelTxId(t.id) }} className="w-full flex items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3 text-left hover:border-violet-300 transition">
                    <TxDirIcon dir={txDirection(t.category, t.amount)} />
                    <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{t.title}</span><span className="block text-xs text-slate-400 truncate">{t.id} · {fmtDateTime(t.createdAt)}</span></span>
                    <span className={`font-extrabold text-sm ${txAmountCls(txDirection(t.category, t.amount))}`}>{txSign(txDirection(t.category, t.amount))}{usdt(Math.abs(t.amount))}</span>
                  </button>
                ))}</div>
              </div>}
            </div>
          )
        })()}
      </Modal>

      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title="Admin notifications">
        <div className="space-y-2">
          {myUnread > 0 && <button onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 active:scale-95 transition"><CheckCheck size={14} /> Mark all read ({myUnread})</button>}
          {myNotifs.length === 0 ? <Empty title="No notifications" body="Deposit, KYC, upgrade, loan and support alerts will appear here." /> : myNotifs.map(n => (
            <button key={n.id} onClick={() => openNotif(n)} className="w-full text-left">
              <div className={`rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3.5 flex gap-3 items-start ${!n.read ? 'border-l-4 border-l-violet-500 bg-violet-50/50 dark:bg-violet-500/5' : 'opacity-75'}`}>
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 shrink-0"><Bell size={15} /></div>
                <div className="flex-1 min-w-0"><p className="font-bold text-sm">{n.title} {!n.read && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-rose-500" />}</p><p className="text-sm text-slate-500">{n.body}</p><p className="text-[11px] text-slate-400 mt-1 capitalize">{n.kind} · {fmtDateTime(n.createdAt)}</p></div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {menuOpen && <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}
      <div className="lg:flex lg:items-start lg:max-w-[1440px] lg:mx-auto">
        {/* Sidebar menu — a slide-in drawer on mobile (hamburger in the header), a fixed sidebar on desktop */}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xl transition-transform duration-300 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:bg-white/70 lg:dark:bg-slate-900/40 lg:backdrop-blur-xl lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Menu</p>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 lg:hidden"><X size={15} /></button>
          </div>
          <nav className="space-y-1">
            <AdminMenuNav tabs={visibleTabs} badges={tabBadges} active={tab} onGo={(id) => { setTab(id); setMenuOpen(false) }} />
          </nav>
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 p-3">
              <Avatar name={user.name} photo={user.photo} />
              <div className="flex-1 min-w-0"><p className="font-extrabold text-sm truncate">{user.name}</p><p className="text-xs text-slate-400 truncate">{user.email}</p></div>
              <Badge tone="amber">Admin</Badge>
            </div>
            <Link to="/" className="mt-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900"><ArrowLeft size={16} /> User app</Link>
          </div>
        </aside>
        <main className="flex-1 min-w-0 w-full max-w-5xl mx-auto px-4 py-6 pb-16">
        {tab === 'overview' && (
          <div className="space-y-4 anim-fade-up">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Registered customers', stats.users], ['Active users', stats.active], ['Total wallet balance', usdt(stats.totalBalance)], ['Revenue (fees)', usdt(Math.round(stats.fees))],
                ['Total deposits', usdt(stats.deposits)], ['Total withdrawals', usdt(stats.withdrawals)], ['Total transfers', usdt(stats.transfers)], ['Referral commissions paid', usdt(stats.refPaid)],
                ['Pending deposits', stats.pendingDeposits.length], ['Pending withdrawals', stats.pendingWithdrawals.length], ['Pending loans', stats.pendingLoans.length], ['Pending KYC', stats.pendingKyc.length],
              ].map(([k, v]) => (
                <Card key={k as string} className="p-4"><p className="text-[11px] uppercase font-bold text-slate-400">{k}</p><p className="text-xl font-extrabold mt-1">{v}</p></Card>
              ))}
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-3">Transaction volume (completed)</h3>
              <div className="h-52"><ResponsiveContainer><BarChart data={chartData}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => usdt(Number(v))} /><Bar dataKey="volume" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Card>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Recent transactions</h3>
              {byDateDesc(db.txs).slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
                  <div className="flex-1 min-w-0"><p className="font-semibold truncate">{t.title}</p><p className="text-xs text-slate-400">{nameOf(t.userId)} · {t.id} · {fmtDateTime(t.createdAt)}</p></div>
                  <span className="font-bold">{usdt(t.amount)}</span><Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'deposits' && (
          <div className="space-y-6 anim-fade-up">
                        <section>
              <h3 className="font-extrabold mb-3">Deposit requests</h3>
              {db.deposits.length === 0 ? <Card><Empty title="No deposit requests" /></Card> : db.deposits.map(d => (
                <Card key={d.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{usdt(d.amount)} · {d.method} — {nameOf(d.userId)}</p><p className="text-xs text-slate-400">{d.id} · TrxID {d.trxId}{d.receipt ? ' · 📎 ' + d.receipt : ''} · {fmtDateTime(d.createdAt)}</p><p className="mt-1 flex gap-1.5 flex-wrap"><span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${d.verification === 'auto' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{d.verification === 'auto' ? '⚡ AUTO-VERIFY' : '👤 MANUAL REVIEW'}</span>{d.providerRef && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">PROVIDER {d.providerRef}</span>}</p></div>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  {d.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => decideDeposit(d.id, true)}><Check size={15} /> Approve</Btn><Btn variant="danger" className="!py-2" onClick={() => decideDeposit(d.id, false)}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Ledger integrity (double-entry)</h3>
              <p className="text-sm text-slate-500">Total ledger entries: <b>{db.ledger.length}</b> · Debits = Credits check: <b className="text-emerald-600">{db.ledger.reduce((s, l) => s + l.debit, 0) - db.ledger.reduce((s, l) => s + l.credit, 0) === 0 ? 'Not applicable per-entry (paired)' : 'Review'} — every transaction writes a balanced pair.</b></p>
              <p className="text-sm text-slate-500 mt-1">Balances are never edited directly outside audited adjustments (see Users tab), which also write ledger entries.</p>
            </Card>
          </div>
        )}

        {tab === 'withdrawals' && (
          <div className="space-y-6 anim-fade-up">
            <section>
              <h3 className="font-extrabold mb-3">Withdrawal requests</h3>
              {db.withdrawals.length === 0 ? <Card><Empty title="No withdrawal requests" /></Card> : db.withdrawals.map(d => (
                <Card key={d.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{usdt(d.amount)} · {d.method} — {nameOf(d.userId)}</p><p className="text-xs text-slate-400">{d.id} → {d.destination} · fee {usdt(d.fee)} · payable {usdt(d.amount - d.fee)} · {fmtDateTime(d.createdAt)}</p></div>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  {d.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => decideWithdraw(d.id, true)}><Check size={15} /> Complete</Btn><Btn variant="danger" className="!py-2" onClick={() => decideWithdraw(d.id, false)}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
          </div>
        )}

        {tab === 'users' && (
          <div className="anim-fade-up">
            <input value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search users by name, email, username, ID…" className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70 px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-violet-500" />
            <div className="space-y-2">
              {db.users.filter(u => (u.name + u.email + u.username + u.id).toLowerCase().includes(userQ.toLowerCase())).map(u => (
                  <Card key={u.id} className="p-4">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => openUser(u)} title="Open user details">
                      <Avatar name={u.name} photo={u.photo} />
                      <div className="flex-1 min-w-0"><p className="font-bold truncate">{u.name}</p><p className="text-xs text-slate-400 truncate">{u.email}</p></div>
                      <Badge tone={u.kyc === 'verified' ? 'green' : 'amber'}>{u.kyc === 'verified' ? '✅ Verified' : 'Unverified'}</Badge>
                    </div>
                  </Card>
              ))}
            </div>
          </div>
        )}

        {tab === 'kyc' && (() => {
          const pending = db.users.filter(u => u.kyc === 'pending')
          const verified = db.users.filter(u => u.kyc === 'verified')
          const none = db.users.filter(u => u.kyc !== 'pending' && u.kyc !== 'verified')
          const docLabel = (t?: string) => t === 'passport' ? 'Passport' : t === 'driving' ? 'Driving Licence' : 'National ID'
          return (
            <div className="anim-fade-up space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Pending review</p><p className="text-xl font-extrabold mt-1">{pending.length}</p><p className="text-xs text-slate-400 mt-0.5">Waiting for a decision</p></Card>
                <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Verified</p><p className="text-xl font-extrabold mt-1">{verified.length}</p><p className="text-xs text-slate-400 mt-0.5">Identity confirmed</p></Card>
                <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Not submitted</p><p className="text-xl font-extrabold mt-1">{none.length}</p><p className="text-xs text-slate-400 mt-0.5">No documents yet</p></Card>
              </div>
              <section>
                <h3 className="font-extrabold mb-3">⏳ Waiting for review</h3>
                {pending.length === 0 ? <Empty title="No pending submissions" body="New KYC submissions will appear here with their documents and face photo." /> : (
                  <div className="space-y-2">{pending.map(u => {
                    const photos = kycPhotos[u.id]
                    return (
                      <div key={u.id} id={'kyc-card-' + u.id}>
                      <Card className={`p-4 ${kycFocus === u.id ? 'ring-2 ring-violet-500' : ''}`}>
                        <div className="flex flex-wrap items-center gap-3">
                          <Avatar name={u.name} photo={u.photo} />
                          <div className="flex-1 min-w-[170px]"><p className="font-bold">{u.name}</p><p className="text-xs text-slate-400">@{u.username} · {u.email}</p>
                            <p className="text-xs text-slate-400 mt-0.5">📄 {docLabel(u.kycDocType)} · <span className="font-mono">{u.kycDocNumber ?? '—'}</span>{u.kycSubmittedAt ? ' · submitted ' + fmtDateTime(u.kycSubmittedAt) : ''}</p></div>
                          <Badge tone="amber">pending</Badge>
                        </div>
                        <AutoCheckChips c={u.kycAutoChecks} />
                        {photos === undefined ? (
                          <Btn variant="outline" className="!py-2 !text-xs mt-3" onClick={() => loadKycPhotos(u)}>View documents & face photo</Btn>
                        ) : photos === 'loading' ? <div className="mt-3 flex items-center gap-2.5"><LogoLoader size={22} /><span className="text-xs text-slate-400">Loading photos…</span></div> : (
                          <div className="flex flex-wrap gap-3 mt-3">
                            {(photos.docPhoto || u.kycDocPhoto) && <figure><a href={photos.docPhoto || u.kycDocPhoto} target="_blank" rel="noreferrer"><img src={photos.docPhoto || u.kycDocPhoto} alt="KYC document" className="h-32 w-48 object-cover rounded-xl border border-slate-200 dark:border-slate-700" /></a><figcaption className="text-[11px] text-slate-400 mt-1 text-center">{docLabel(u.kycDocType)}</figcaption></figure>}
                            {(photos.facePhoto || u.kycFacePhoto) && <figure><a href={photos.facePhoto || u.kycFacePhoto} target="_blank" rel="noreferrer"><img src={photos.facePhoto || u.kycFacePhoto} alt="KYC face scan" className="h-32 w-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700" /></a><figcaption className="text-[11px] text-slate-400 mt-1 text-center">Face photo</figcaption></figure>}
                            {!photos.docPhoto && !photos.facePhoto && !u.kycDocPhoto && !u.kycFacePhoto && <p className="text-xs text-slate-400">No photos found on the server for this submission.</p>}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Btn variant="success" className="!py-2 !text-xs" onClick={() => decideKyc(u.id, true)}>✅ Verify KYC</Btn>
                          <Btn variant="danger" className="!py-2 !text-xs" onClick={() => decideKyc(u.id, false)}>Reject</Btn>
                        </div>
                      </Card>
                      </div>
                    )
                  })}</div>
                )}
              </section>
              <section>
                <h3 className="font-extrabold mb-3">✅ Verified users</h3>
                {verified.length === 0 ? <Empty title="No verified users yet" body="Users you verify will be listed here with their document details." /> : (
                  <div className="space-y-2">{verified.map(u => (
                    <div key={u.id} id={'kyc-card-' + u.id}>
                    <Card className={`p-4 ${kycFocus === u.id ? 'ring-2 ring-violet-500' : ''}`}><div className="flex flex-wrap items-center gap-3">
                      <Avatar name={u.name} photo={u.photo} />
                      <div className="flex-1 min-w-[170px]"><p className="font-bold">{u.name}</p><p className="text-xs text-slate-400">@{u.username} · {u.email}</p>
                        {u.kycDocType === 'manual' ? <p className="text-xs text-slate-400 mt-0.5">🛡️ Verified by NovaWallet — manual verification, no documents submitted</p> : u.kycDocType && <p className="text-xs text-slate-400 mt-0.5">📄 {docLabel(u.kycDocType)} · <span className="font-mono">{u.kycDocNumber}</span>{u.kycSubmittedAt ? ' · submitted ' + fmtDateTime(u.kycSubmittedAt) : ''}</p>}</div>
                      <Badge tone="green">✅ Verified</Badge>
                    </div></Card>
                    </div>
                  ))}</div>
                )}
              </section>
              {none.length > 0 && (
                <section>
                  <h3 className="font-extrabold mb-1">Unverified — not submitted</h3>
                  <p className="text-xs text-slate-400 mb-3">These users never submitted documents. If you know a customer personally, you can verify them manually — their profile will then show a plain <b>“Verified”</b> badge.</p>
                  <div className="space-y-2">{none.map(u => (
                    <div key={u.id} id={'kyc-card-' + u.id}>
                    <Card className={`p-4 ${kycFocus === u.id ? 'ring-2 ring-violet-500' : ''}`}><div className="flex flex-wrap items-center gap-3">
                      <Avatar name={u.name} photo={u.photo} />
                      <div className="flex-1 min-w-[170px]"><p className="font-bold">{u.name}</p><p className="text-xs text-slate-400">@{u.username} · {u.email}</p></div>
                      <Btn variant="success" className="!py-1.5 !text-xs" onClick={() => { setManualReason(''); setManualFor(u) }}>✅ Verify manually</Btn>
                      <Badge tone="slate">Not submitted</Badge>
                    </div></Card>
                    </div>
                  ))}</div>
                </section>
              )}
            </div>
          )
        })()}

        {tab === 'loans' && (
          <div className="anim-fade-up space-y-2">
            {db.loans.length === 0 ? <Card><Empty title="No loan applications" /></Card> : db.loans.map(l => (
              <Card key={l.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[190px]"><p className="font-bold">{l.id} · {usdt(l.amount)} — {nameOf(l.userId)}</p><p className="text-xs text-slate-400">{l.months} mo · {l.ratePct}% · EMI {usdt(l.emi)} · Total {usdt(l.totalPayable)} · Paid {usdt(l.paid)} · {fmtDateTime(l.createdAt)}</p>
                    {l.status === 'active' && l.paid < l.totalPayable * 0.3 && <p className="text-xs text-amber-600 font-bold mt-0.5">Watch: low repayment progress</p>}</div>
                  <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  {l.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => decideLoan(l.id, true)}>Approve & disburse</Btn><Btn variant="danger" className="!py-2" onClick={() => decideLoan(l.id, false)}>Reject</Btn></>}
                </div>
                {l.applicantName && (
                  <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 flex gap-3.5">
                    <div className="flex flex-col gap-2 shrink-0">
                      {l.photo && <img src={l.photo} alt={l.applicantName} title="Applicant photo" className="w-16 h-16 rounded-2xl object-cover" />}
                      {l.idPhoto && <img src={l.idPhoto} alt="ID document" title={l.idType ?? 'ID'} className="w-16 h-16 rounded-2xl object-cover" />}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-5 gap-y-1 text-[13px] flex-1 min-w-0">
                      <p><span className="text-slate-400">Name:</span> <b>{l.applicantName}</b></p>
                      <p><span className="text-slate-400">Phone:</span> <b>{l.phone}</b></p>
                      <p><span className="text-slate-400">WhatsApp:</span> <b>{l.whatsapp}</b></p>
                      <p><span className="text-slate-400">{l.idType ?? 'NID'}:</span> <b>{l.nid}</b></p>
                      <p><span className="text-slate-400">Guarantor:</span> <b>{l.guarantorName}</b></p>
                      <p><span className="text-slate-400">Guarantor mobile:</span> <b>{l.guarantorPhone}</b></p>
                    </div>
                  </div>
                )}
                {(l.autoChecks || l.status === 'pending') && <AutoCheckChips c={l.autoChecks} loan />}
                <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-3.5 py-3">
                  <p className="font-extrabold text-sm">Processing fee</p>
                  {l.processingFee ? <>
                    <span className="font-bold">{usdt(l.processingFee)}</span>
                    <Badge tone={l.feeStatus === 'paid' ? 'green' : l.feeStatus === 'submitted' ? 'violet' : 'amber'}>{l.feeStatus === 'paid' ? '✓ Paid' : l.feeStatus === 'submitted' ? 'Submitted — check & confirm' : 'Unpaid'}</Badge>
                    {l.feeStatus === 'submitted' && <span className="text-xs text-slate-500">via {l.feeMethod} · Ref: <b className="font-mono">{l.feeTxRef}</b></span>}
                    {l.feeStatus === 'submitted' && <Btn className="!py-1.5 !text-xs !bg-emerald-500" onClick={() => { confirmLoanFee(l.id); toast({ kind: 'success', title: 'Fee marked as paid' }) }}>Confirm fee paid</Btn>}
                  </> : <>
                    <div className="w-[150px]"><Input type="number" placeholder="Amount (USDT)" value={feeInputs[l.id] ?? ''} onChange={e => setFeeInputs(f => ({ ...f, [l.id]: e.target.value }))} /></div>
                    <Btn variant="outline" className="!py-2 !text-xs" onClick={() => { const a = Number(feeInputs[l.id]); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter a fee amount' }); setLoanFee(l.id, Math.round(a * db.settings.bdtPerUsd)); toast({ kind: 'success', title: 'Processing fee set', body: 'It now shows in the Loan section with a Pay button.' }) }}>Set fee</Btn>
                  </>}
                </div>
              </Card>
            ))}
            <Card className="p-5 text-sm text-slate-500">Loan config (limits, rate) lives in Settings. The payment options customers see for processing fees also live in Settings — one shared list with the main website (Add Money).</Card>
          </div>
        )}

        {tab === 'referrals' && (
          <div className="anim-fade-up space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Commission rate</p><p className="text-xl font-extrabold mt-1">{db.settings.referralPct}%</p></Card>
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Total paid</p><p className="text-xl font-extrabold mt-1">{usdt(stats.refPaid)}</p></Card>
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Referred users</p><p className="text-xl font-extrabold mt-1">{db.users.filter(u => u.referredBy).length}</p></Card>
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Suspicious referral check</h3>
              <p className="text-sm text-slate-500">Self-referrals are blocked at registration. Duplicate email/username signups are rejected. Accounts flagged: <b>{db.users.filter(u => u.status === 'suspended').length}</b> suspended.</p>
              <div className="mt-3 space-y-1.5">{db.referralEarnings.map(r => <p key={r.id} className="text-sm">{nameOf(r.userId)} earned {usdt(r.amount)} from {r.fromUser} · {fmtDateTime(r.createdAt)}</p>)}</div>
            </Card>
          </div>
        )}

        {tab === 'broadcast' && (
          <div className="anim-fade-up">
            <Card className="p-5">
              <h3 className="font-extrabold flex items-center gap-2"><Send size={17} className="text-violet-500" /> Broadcast to all users</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Sends a notification to every account ({db.users.length} users). It appears in their notification list on every device — use it for maintenance notices and announcements.</p>
              <div className="space-y-3">
                <Input label="Title" placeholder="Scheduled maintenance tonight" value={bcTitle} onChange={e => setBcTitle(e.target.value)} />
                <Input label="Message" placeholder="The app will be unavailable from 2:00–2:30 AM. Your funds are safe." value={bcBody} onChange={e => setBcBody(e.target.value)} />
                <Btn className="w-full" disabled={bcBusy} onClick={async () => { if (!bcTitle.trim() || !bcBody.trim()) return toast({ kind: 'error', title: 'Write a title and a message' }); setBcBusy(true); const e = await broadcast(bcTitle.trim(), bcBody.trim()); setBcBusy(false); if (e) return toast({ kind: 'error', title: e }); setBcTitle(''); setBcBody(''); toast({ kind: 'success', title: 'Broadcast sent', body: 'Every user will see it in their notifications.' }) }}>{bcBusy ? 'Sending…' : 'Send broadcast'}</Btn>
              </div>
            </Card>
          </div>
        )}

        {tab === 'news' && (
          <div className="anim-fade-up">
            <section>
              <div className="flex items-center justify-between mb-3"><h3 className="font-extrabold">News</h3><Btn onClick={() => setNewsForm({ title: '', category: 'Bitcoin', excerpt: '', body: '', source: 'Nova Market Desk', featured: false, gradient: 'from-violet-500 to-purple-700', coin: 'BTC' })}>+ Publish news</Btn></div>
              {db.news.map(n => (
                <Card key={n.id} className="p-4 mb-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0"><p className="font-bold truncate">{n.title}</p><p className="text-xs text-slate-400">{n.category} · {n.source} · {fmtDateTime(n.date)}{n.featured ? ' · ⭐ Featured' : ''}</p></div>
                  <Btn variant="ghost" className="!py-1.5 !text-xs" onClick={() => setNewsForm({ ...n })}>Edit</Btn>
                  <Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => { deleteNews(n.id); toast({ kind: 'info', title: 'News deleted' }) }}>Delete</Btn>
                </Card>
              ))}
            </section>
          </div>
        )}

        {tab === 'banners' && (
          <div className="anim-fade-up">
            <section>
              <div className="flex items-center justify-between mb-3"><h3 className="font-extrabold flex items-center gap-2"><Megaphone size={17} /> Promotional banners</h3><Btn onClick={() => setBannerForm({ title: '', subtitle: '', gradient: 'from-violet-600 via-purple-600 to-indigo-600', active: true })}>+ Add banner</Btn></div>
              {db.banners.length === 0 && <Card><Empty title="No banners yet — add your first promotion" /></Card>}
              {db.banners.map(b => (
                <div key={b.id} className={`rounded-3xl bg-gradient-to-br ${b.gradient} text-white p-4 mb-2 flex items-center gap-3`}>
                  <div className="flex-1 min-w-0"><p className="font-extrabold">{b.title}</p><p className="text-white/80 text-sm">{b.subtitle}</p></div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => toggleBanner(b.id)} className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">{b.active ? 'Active — tap to hide' : 'Hidden — tap to show'}</button>
                    <div className="flex gap-1.5">
                      <button onClick={() => moveBanner(b.id, 'up')} className="flex-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">↑ Up</button>
                      <button onClick={() => moveBanner(b.id, 'down')} className="flex-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">↓ Down</button>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setBannerForm({ ...b })} className="flex-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">Edit</button>
                      <button onClick={() => { deleteBanner(b.id); toast({ kind: 'info', title: 'Banner deleted' }) }} className="flex-1 rounded-full bg-rose-500/80 px-3 py-1.5 text-xs font-bold">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'levels' && (
          <div className="anim-fade-up space-y-6">
            <section>
              <h3 className="font-extrabold mb-3">Upgrade requests</h3>
              {db.levelRequests.length === 0 ? <Card><Empty title="No upgrade requests" /></Card> : db.levelRequests.map(r => (
                <Card key={r.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{nameOf(r.userId)} — Level {r.fromLevel} → Level {r.toLevel}</p><p className="text-xs text-slate-400">{r.id} · {fmtDateTime(r.createdAt)}</p></div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => decideUpgrade(r.id, true)}><Check size={15} /> Approve</Btn><Btn variant="danger" className="!py-2" onClick={() => decideUpgrade(r.id, false)}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
            <section>
              <h3 className="font-extrabold mb-3">Level definitions (managed here, applied everywhere)</h3>
              {db.levels.map(l => {
                const f = levelForms[l.level] ?? l
                const upd = (k: string, v: any) => setLevelForms(prev => ({ ...prev, [l.level]: { ...f, [k]: v } }))
                return (
                  <Card key={l.level} className="p-4 mb-3">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${l.gradient} text-white flex items-center justify-center font-extrabold`}>{l.level}</span>
                      <p className="font-extrabold">Level {l.level}</p>
                      <Badge tone="slate">{db.users.filter(u => u.level === l.level && u.role === 'user').length} users</Badge>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input label="Tagline" value={f.tagline} onChange={e => upd('tagline', e.target.value)} />
                      <Input label="Daily limit (USDT)" type="number" value={Math.round(f.dailyLimit / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('dailyLimit', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Monthly limit (USDT)" type="number" value={Math.round(f.monthlyLimit / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('monthlyLimit', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Loan limit (USDT)" type="number" value={Math.round(f.loanLimit / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('loanLimit', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Required total deposit (USDT)" type="number" value={Math.round((f.depositRequired ?? 0) / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('depositRequired', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Fee discount %" type="number" value={f.feeDiscountPct} onChange={e => upd('feeDiscountPct', Number(e.target.value))} />
                    </div>
                    <Input label="Requirement" className="mt-3" value={f.requirement} onChange={e => upd('requirement', e.target.value)} />
                    <Btn className="mt-3" onClick={() => { updateLevelDef(l.level, f); toast({ kind: 'success', title: 'Level ' + l.level + ' updated' }) }}>Save Level {l.level}</Btn>
                  </Card>
                )
              })}
            </section>
            <section>
              <h3 className="font-extrabold mb-3">Set a user's level directly</h3>
              {db.users.filter(u => u.role === 'user').map(u => (
                <Card key={u.id} className="p-3.5 mb-2 flex items-center gap-3">
                  <Avatar name={u.name} size={36} photo={u.photo} />
                  <div className="flex-1 min-w-[120px]"><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-slate-400">@{u.username} · KYC {u.kyc}</p></div>
                  <select value={u.level} onChange={e => { setUserLevel(u.id, Number(e.target.value)); toast({ kind: 'success', title: u.name + ' → Level ' + e.target.value }) }} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Level {n}</option>)}
                  </select>
                </Card>
              ))}
            </section>
          </div>
        )}

        {tab === 'wishlist' && (
          <div className="anim-fade-up">
            <div className="flex items-center justify-between mb-3"><h3 className="font-extrabold">Cards wishlist</h3><Badge tone="violet">{(db.wishlist ?? []).length} joined</Badge></div>
            {(db.wishlist ?? []).length === 0 ? <Card><Empty title="No card requests yet" body="KYC-verified users who tap Notify me on the Cards page will appear here." /></Card> : (db.wishlist ?? []).map(w => (
              <Card key={w.id} className="p-4 mb-2 flex items-center gap-3">
                <Avatar name={w.name || w.email} />
                <div className="flex-1 min-w-0"><p className="font-bold truncate">{w.name}</p><p className="text-xs text-slate-400 truncate">{w.email} · @{w.username}</p></div>
                <span className="text-xs text-slate-400 shrink-0">{fmtDateTime(w.createdAt)}</span>
              </Card>
            ))}
          </div>
        )}

        {tab === 'support' && <SupportChat />}
        {tab === 'txs' && (
          <div className="space-y-3">
            <Card className="p-4">
              <Input label="Search by Transaction ID" placeholder="Paste or type the Transaction ID, e.g. TXN-…" value={txQ} onChange={e => setTxQ(e.target.value)} />
              <p className="text-xs text-slate-400 mt-2">Built for customer support — every transaction carries its own ID. Search also matches the customer name, title or counterparty. {filteredTxs.length} transaction(s) found.</p>
            </Card>
            {filteredTxs.length === 0 ? <Card><Empty title="No transactions match that search" /></Card> : filteredTxs.slice(0, 100).map(tx => { const tu = db.users.find(u => u.id === tx.userId); const dir = txDirection(tx.category, tx.amount); return (
              <button key={tx.id} onClick={() => setSelTxId(tx.id)} className="w-full text-left">
                <Card className="p-4 hover:border-violet-300 transition">
                  <div className="flex items-start gap-3">
                    <TxDirIcon dir={dir} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{tx.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{tu?.name ?? tx.userId} · {fmtDateTime(tx.createdAt)}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{tx.id}</p>
                    </div>
                    <div className="text-right shrink-0"><p className={`font-extrabold ${txAmountCls(dir)}`}>{txSign(dir)}{usdt(Math.abs(tx.amount))}</p><div className="mt-1"><Badge tone={statusTone(tx.status)}>{tx.status}</Badge></div></div>
                  </div>
                </Card>
              </button>
            ) })}
          </div>
        )}
        {tab === 'audit' && (
          <div className="anim-fade-up space-y-2">
            {db.audit.length === 0 ? <Empty title="No audit entries yet" body="Admin actions — approvals, settings changes, role updates — are recorded here automatically." /> : db.audit.map(a => (
              <Card key={a.id} className="p-4 text-sm min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-bold break-words min-w-0">{a.action} <span className="text-slate-400 font-normal">by {nameOf(a.actor)}</span></p>
                  <p className="text-[11px] text-slate-400 shrink-0">{fmtDateTime(a.createdAt)}</p>
                </div>
                {a.detail && <p className="text-slate-500 break-words mt-1">{a.detail}</p>}
              </Card>
            ))}
          </div>
        )}

        {tab === 'payments' && pmList && (
          <div className="anim-fade-up space-y-4">
            <Card className="p-5">
              <h3 className="font-extrabold">Payment Methods</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">The bank accounts and crypto wallets customers send money to. This one list is shown in <b>Add Money</b> (with copy buttons), in loan-fee payments and in Profile — the same in every country.</p>
              <Btn className="w-full py-3 mt-4" onClick={() => setPmEdit({ idx: null, draft: { id: 'pm' + Date.now(), kind: 'bank', label: '', accountName: '', accountNumber: '', routing: '', swift: '', branch: '', verification: 'manual' } })}>＋ Add payment method</Btn>
            </Card>
            {pmList.length === 0 ? <Card className="p-5"><Empty title="No payment methods yet" body="Add your first bank account or crypto wallet so customers can deposit." /></Card> : (
              <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                {pmList.map((pm, i) => (
                  <div key={pm.id} className="flex items-center gap-3 p-4">
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${pm.kind === 'crypto' ? 'bg-amber-100 dark:bg-amber-500/15' : 'bg-violet-100 dark:bg-violet-500/15'}`}>{pm.kind === 'crypto' ? '₿' : '🏦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{pm.kind === 'crypto' ? (pm.label + (pm.network ? ' · ' + pm.network : '')) : pm.label}</p>
                      <p className="text-xs text-slate-400 truncate">{pm.kind === 'crypto' ? (pm.accountNumber || 'No address set') : ((pm.accountNumber || 'No account number') + (pm.branch ? ' · ' + pm.branch : ''))}</p>
                    </div>
                    <Btn variant="outline" className="!py-2 !px-3.5 !text-xs shrink-0" onClick={() => setPmEdit({ idx: i, draft: { ...pm } })}>Edit</Btn>
                    <Btn variant="danger" className="!py-2 !px-3.5 !text-xs shrink-0" onClick={() => setPmDel(pm)}>Delete</Btn>
                  </div>
                ))}
              </Card>
            )}
            <Modal open={!!pmEdit} onClose={() => setPmEdit(null)} title={pmEdit?.idx === null ? 'Add payment method' : 'Edit payment method'}>
              {pmEdit && (() => { const d = pmEdit.draft; const selfIdx = pmEdit.idx; const setD = (patch: Partial<PayMethod>) => setPmEdit(cur => cur ? { ...cur, draft: { ...cur.draft, ...patch } } : cur)
                const usedNetworks = new Set(pmList.filter((m, j) => m.kind === 'crypto' && j !== selfIdx && (m.label ?? '').trim().toLowerCase() === (d.label ?? '').trim().toLowerCase()).map(m => m.network ?? ''))
                const networkOptions = CRYPTO_NETWORK_LABELS.filter(n => !usedNetworks.has(n) || n === (d.network ?? ''))
                return (
                  <div className="space-y-3.5">
                    <Select label="Type" value={d.kind} onChange={(e: any) => setD({ kind: e.target.value })}>
                      <option value="bank">🏦 Bank account</option>
                      <option value="crypto">₿ Crypto wallet</option>
                    </Select>
                    <Select label="Verification" value={d.verification ?? 'manual'} onChange={(e: any) => setD({ verification: e.target.value })}>
                      <option value="manual">👤 Manual review — admin approves each deposit</option>
                      <option value="auto">⚡ Auto-verify — settles automatically once a provider is connected</option>
                    </Select>
                    {(d.verification ?? 'manual') === 'auto' && <p className="text-xs text-slate-400 leading-relaxed">Auto deposits are tagged and routed separately in the Finance queue with their normalized reference, ready for a bank API / gateway / SMS-webhook matcher. Until a provider is connected they still wait in the queue — nothing is auto-approved yet.</p>}
                    {d.kind === 'bank' ? (
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Input label="Bank name" placeholder="e.g. BRAC Bank" value={d.label} onChange={e => setD({ label: e.target.value })} />
                        <Input label="Account name / title" placeholder="e.g. NovaWallet" value={d.accountName ?? ''} onChange={e => setD({ accountName: e.target.value })} />
                        <Input label="Account number" placeholder="e.g. 1501200000001" value={d.accountNumber ?? ''} onChange={e => setD({ accountNumber: e.target.value })} />
                        <Input label="Branch" placeholder="e.g. Sylhet Branch" value={d.branch ?? ''} onChange={e => setD({ branch: e.target.value })} />
                        <Input label="Routing No" placeholder="e.g. 060261234" value={d.routing ?? ''} onChange={e => setD({ routing: e.target.value })} />
                        <Input label="SWIFT Code" placeholder="e.g. BRAKBDDH" value={d.swift ?? ''} onChange={e => setD({ swift: e.target.value })} />
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3.5">
                        <Input label="Coin / asset" placeholder="e.g. USDT" value={d.label} onChange={e => { const label = e.target.value; const taken = new Set(pmList.filter((m, j) => m.kind === 'crypto' && j !== selfIdx && (m.label ?? '').trim().toLowerCase() === label.trim().toLowerCase()).map(m => m.network ?? '')); setD({ label, ...(taken.has(d.network ?? '') ? { network: CRYPTO_NETWORK_LABELS.find(n => !taken.has(n)) ?? d.network } : {}) }) }} />
                        <Select label="Network / transfer system" value={d.network ?? CRYPTO_NETWORK_LABELS[3]} onChange={(e: any) => setD({ network: e.target.value })}>
                          {networkOptions.map(n => <option key={n}>{n}</option>)}
                        </Select>
                        <Input label="Wallet name (optional)" placeholder="e.g. NovaWallet" value={d.accountName ?? ''} onChange={e => setD({ accountName: e.target.value })} />
                        <Input label="Wallet address" placeholder="Paste the receiving address" value={d.accountNumber ?? ''} onChange={e => setD({ accountNumber: e.target.value })} />
                      </div>
                    )}
                    {d.kind === 'crypto' && networkOptions.length < CRYPTO_NETWORK_LABELS.length && <p className="text-xs text-slate-400">Networks already added for this coin are hidden from the dropdown — each coin + network can be added only once.</p>}
                    <div className="flex gap-2 pt-1">
                      <Btn className="flex-1 py-3" onClick={savePm}>Save</Btn>
                      <Btn variant="ghost" className="flex-1 py-3" onClick={() => setPmEdit(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) })()}
            </Modal>
            <Modal open={!!pmDel} onClose={() => setPmDel(null)} title="Delete payment method?">
              <p className="text-sm text-slate-500 dark:text-slate-400">Remove <b>{pmDel?.kind === 'crypto' ? (pmDel?.label + (pmDel?.network ? ' · ' + pmDel.network : '')) : pmDel?.label}</b> from the list? Customers will no longer see it in Add Money. This takes effect immediately.</p>
              <div className="flex gap-2 mt-5">
                <Btn variant="danger" className="flex-1 py-3" onClick={deletePm}>Delete</Btn>
                <Btn variant="ghost" className="flex-1 py-3" onClick={() => setPmDel(null)}>Cancel</Btn>
              </div>
            </Modal>
          </div>
        )}

        {tab === 'reports' && (() => {
          const since30 = Date.now() - 30 * 864e5
          const in30 = (iso: string) => new Date(iso).getTime() > since30
          const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0)
          const depA = db.deposits.filter(d => d.status === 'approved')
          const wdA = db.withdrawals.filter(w => w.status === 'completed')
          const feeTotal = db.txs.filter(t => t.status === 'completed').reduce((s, t) => s + (t.fee || 0), 0)
          const fee30 = db.txs.filter(t => t.status === 'completed' && in30(t.createdAt)).reduce((s, t) => s + (t.fee || 0), 0)
          const stats: [string, string, string][] = [
            ['Deposits approved (30d)', usdt(sum(depA.filter(d => in30(d.createdAt)), d => d.amount)), 'All time ' + usdt(sum(depA, d => d.amount))],
            ['Withdrawals paid (30d)', usdt(sum(wdA.filter(w => in30(w.createdAt)), w => w.amount)), 'All time ' + usdt(sum(wdA, w => w.amount))],
            ['Fee revenue (30d)', usdt(fee30), 'All time ' + usdt(feeTotal)],
            ['New users (30d)', String(db.users.filter(u => in30(u.createdAt)).length), 'Total ' + db.users.length + ' users'],
          ]
          return (
            <div className="anim-fade-up space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {stats.map(([label, value, sub]) => (
                  <Card key={label} className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className="text-xl font-extrabold mt-1">{value}</p><p className="text-xs text-slate-400 mt-0.5">{sub}</p></Card>
                ))}
              </div>
              <Card className="p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Download size={17} className="text-violet-500" /> Export data (CSV)</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Downloads open in Excel or Google Sheets — handy for accounting and tax records.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-transactions.csv', db.txs.map(t => ({ id: t.id, date: t.createdAt, user: db.users.find(u => u.id === t.userId)?.email ?? t.userId, category: t.category, title: t.title, amount_bdt: t.amount, fee_bdt: t.fee || 0, status: t.status })))}>Transactions ({db.txs.length})</Btn>
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-users.csv', db.users.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, level: u.level, kyc: u.kyc, status: u.status, joined: u.createdAt })))}>Users ({db.users.length})</Btn>
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-deposits.csv', db.deposits.map(d => ({ id: d.id, date: d.createdAt, user: db.users.find(u => u.id === d.userId)?.email ?? d.userId, method: d.method, amount_bdt: d.amount, trx_id: d.trxId, status: d.status })))}>Deposits ({db.deposits.length})</Btn>
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-withdrawals.csv', db.withdrawals.map(w => ({ id: w.id, date: w.createdAt, user: db.users.find(u => u.id === w.userId)?.email ?? w.userId, method: w.method, amount_bdt: w.amount, fee_bdt: w.fee, destination: w.destination, status: w.status })))}>Withdrawals ({db.withdrawals.length})</Btn>
                </div>
              </Card>
            </div>
          )
        })()}

        {tab === 'health' && (
          <div className="anim-fade-up space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">API server</p><p className="text-xl font-extrabold mt-1">{apiHealth === null ? 'Checking…' : apiHealth.ok ? '🟢 Online' : '🔴 Unreachable'}</p><p className="text-xs text-slate-400 mt-0.5">{apiHealth?.ok ? 'novawallet-api · v' + (apiHealth.version ?? '') : 'Live status of the backend'}</p></Card>
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Registered users</p><p className="text-xl font-extrabold mt-1">{db.users.length}</p><p className="text-xs text-slate-400 mt-0.5">Synced from the server</p></Card>
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Open support chats</p><p className="text-xl font-extrabold mt-1">{db.tickets.filter(t => t.status !== 'resolved').length}</p><p className="text-xs text-slate-400 mt-0.5">Waiting in Support Chat</p></Card>
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Crash reports</p><p className="text-xl font-extrabold mt-1">{adminErrors.length}</p><p className="text-xs text-slate-400 mt-0.5">Latest 50 app errors</p></Card>
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-1">App crash reports</h3>
              <p className="text-xs text-slate-400 mb-4">Errors users hit in the app are recorded automatically — newest first.</p>
              {adminErrors.length === 0 ? <Empty title="No crash reports" body="When a user's app hits an error, it will show up here with the page and the message." /> : (
                <div className="space-y-2">{adminErrors.map(e => { const eu = db.users.find(u => u.id === e.userId || (u as any).fbUid === e.userId); return (
                  <div key={e.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3.5">
                    <p className="font-bold text-sm text-rose-500">{e.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{eu ? eu.name + ' · ' + eu.email : 'Unknown user'} · {e.url ?? ''} · {fmtDateTime(e.createdAt)}</p>
                  </div>
                ) })}</div>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="font-extrabold flex items-center gap-2"><Download size={17} className="text-violet-500" /> Database backup</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Download a full JSON snapshot of the live database — users, wallets, transactions, deposits, withdrawals, loans, KYC, tickets and settings. Keep it somewhere safe.</p>
              <Btn onClick={async () => { try { const r = await apiGet('/v1/admin/backup'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.backup, null, 1)], { type: 'application/json' })); a.download = 'novawallet-backup.json'; a.click(); URL.revokeObjectURL(a.href); toast({ kind: 'success', title: 'Backup downloaded' }) } catch (e: any) { toast({ kind: 'error', title: e.message }) } }}>Download backup</Btn>
            </Card>
          </div>
        )}

        {tab === 'emaillog' && (
          <div className="anim-fade-up space-y-4">
            <Card className="p-5">
              <h3 className="font-extrabold flex items-center gap-2"><Mail size={17} className="text-violet-500" /> Email delivery</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Every email the system sends is recorded here — verification codes, transaction receipts and security alerts. Send a test to confirm delivery any time.</p>
              <Btn disabled={testMailBusy} onClick={sendTestMail}>{testMailBusy ? <Loader2 size={16} className="animate-spin" /> : 'Send test email to my address'}</Btn>
            </Card>
            <Card className="p-5">
              <h3 className="font-extrabold mb-1">Recent emails</h3>
              <p className="text-xs text-slate-400 mb-4">Latest 50, newest first.</p>
              {emailLog === null ? <PageLoader compact label="Loading…" /> : emailLog.length === 0 ? <Empty title="No emails yet" body="When the system sends an email, it will show up here." /> : (
                <div className="space-y-2">{emailLog.map((e: any) => (
                  <div key={e.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3.5">
                    <p className="font-bold text-sm flex items-center gap-2 flex-wrap">{e.subject} <Badge tone={e.status === 'sent' ? 'green' : 'red'}>{e.status}</Badge> <Badge tone="slate">{e.kind}</Badge></p>
                    <p className="text-xs text-slate-400 mt-1">To {e.to} · {fmtDateTime(e.createdAt)}{e.error ? ' · ' + e.error : ''}</p>
                  </div>
                ))}</div>
              )}
            </Card>
          </div>
        )}

        {tab === 'settings' && (
          <div className="anim-fade-up">
            <Card className="p-5 space-y-4">
              <h3 className="font-extrabold">Platform settings</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Platform name" value={setForm.platformName} onChange={e => setSetForm(s => ({ ...s, platformName: e.target.value }))} />
                <Input label="BDT per USDT" type="number" value={setForm.bdtPerUsd} onChange={e => setSetForm(s => ({ ...s, bdtPerUsd: Number(e.target.value) }))} />
                <Input label="Send fee %" type="number" step="0.1" value={setForm.sendFeePct} onChange={e => setSetForm(s => ({ ...s, sendFeePct: Number(e.target.value) }))} />
                <Input label="Cash out fee %" type="number" step="0.1" value={setForm.cashoutFeePct} onChange={e => setSetForm(s => ({ ...s, cashoutFeePct: Number(e.target.value) }))} />
                <Input label="Step-up verification above (BDT)" type="number" step="1000" value={setForm.stepUpThresholdBdt ?? 25000} onChange={e => setSetForm(s => ({ ...s, stepUpThresholdBdt: Number(e.target.value) }))} />
                <Input label="First deposit bonus (%)" type="number" step="10" value={setForm.firstDepositBonusPct ?? 100} onChange={e => setSetForm(s => ({ ...s, firstDepositBonusPct: Number(e.target.value) }))} />
                <Input label="Referral commission %" type="number" value={setForm.referralPct} onChange={e => setSetForm(s => ({ ...s, referralPct: Number(e.target.value) }))} />
                <Input label="Loan interest % / year" type="number" value={setForm.loanRatePct} onChange={e => setSetForm(s => ({ ...s, loanRatePct: Number(e.target.value) }))} />
                <Input label="Min loan (USDT)" type="number" value={Math.round(setForm.minLoan / setForm.bdtPerUsd * 100) / 100} onChange={e => setSetForm(s => ({ ...s, minLoan: Math.round(Number(e.target.value) * s.bdtPerUsd) }))} />
                <Input label="Max loan / limit (USDT)" type="number" value={Math.round(setForm.maxLoan / setForm.bdtPerUsd * 100) / 100} onChange={e => setSetForm(s => ({ ...s, maxLoan: Math.round(Number(e.target.value) * s.bdtPerUsd), loanLimit: Math.round(Number(e.target.value) * s.bdtPerUsd) }))} />
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold">💳 Payment methods (bank accounts & crypto wallets) are managed in their own tab.</p>
                <Btn variant="outline" className="!py-2 !text-xs" onClick={() => setTab('payments')}>Open Payment Methods</Btn>
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 font-semibold text-sm">Maintenance mode
                <input type="checkbox" checked={setForm.maintenance} onChange={e => setSetForm(s => ({ ...s, maintenance: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label>
              <Btn className="w-full" onClick={() => { updateSettings(setForm); toast({ kind: 'success', title: 'Settings saved' }) }}>Save settings</Btn>
              <p className="text-xs text-slate-400">Payment methods supported: Bank Transfer and Crypto Deposit — the same in every region. Cryptocurrencies: 32 coins with live market data. Admin roles: Full (owner), Finance, Content, Support — enforced by the server on every request.</p>
            </Card>
          </div>
        )}

        {tab === 'features' && (
          <div className="anim-fade-up">
            <Card className="p-5 space-y-3">
              <h3 className="font-extrabold">Feature switches</h3>
              <p className="text-xs text-slate-400">Pause a service for maintenance — the server blocks it for everyone right away and the app shows a maintenance notice instead of the form.</p>
              {feat && ([['deposits', '💰 Deposits — Add Money'], ['withdrawals', '🏧 Withdrawals — Cash Out & Direct Withdraw'], ['trading', '📈 Trading — Buy, Sell & Swap'], ['loans', '🏦 New loan applications'], ['registration', '🆕 New account registrations']] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 font-semibold text-sm">{label}
                  <input type="checkbox" checked={!!feat[k]} onChange={e => setFeat((f: any) => ({ ...f, [k]: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label>
              ))}
              <Btn className="w-full" onClick={() => { if (feat) updateSettings({ features: feat }); toast({ kind: 'success', title: 'Feature switches saved' }) }}>Save feature switches</Btn>
            </Card>
          </div>
        )}

        {tab === 'danger' && (
          <div className="anim-fade-up">
            <Card className="p-5">
              <h3 className="font-extrabold text-rose-600 mb-2">Danger zone</h3>
              <Btn variant="danger" onClick={() => { resetDemo(); toast({ kind: 'info', title: 'Demo data reset to seed' }) }}>Reset demo data</Btn>
            </Card>
          </div>
        )}
        </main>
      </div>

      <Modal open={!!kycStepUpFor} onClose={() => setKycStepUpFor(null)} title="Confirm it's you">
        <p className="text-sm text-slate-500 mb-3">Viewing identity documents needs a fresh password check. This view is written to the audit log.</p>
        <Input label="Your account password" type="password" value={kycStepPw} onChange={e => setKycStepPw(e.target.value)} />
        <Btn className="w-full mt-3" disabled={kycStepBusy || !kycStepPw} onClick={submitKycStepUp}>{kycStepBusy ? 'Checking…' : 'Verify & view documents'}</Btn>
      </Modal>
      <Modal open={!!manualFor} onClose={() => setManualFor(null)} title="Verify manually — no documents">
        <p className="text-sm text-slate-500 mb-3">You are verifying <b>{manualFor?.name}</b> without any submitted documents. This is restricted to the full admin, and the reason is written to the audit log.</p>
        <Input label="Reason (required)" value={manualReason} onChange={e => setManualReason(e.target.value)} placeholder="e.g. Known customer — documents checked in person" />
        <Btn variant="success" className="w-full mt-3" disabled={manualBusy} onClick={submitManualVerify}>{manualBusy ? 'Verifying…' : '✅ Verify manually'}</Btn>
      </Modal>
      <Modal open={!!selTx} onClose={() => setSelTxId(null)} title="Transaction details">
        {selTx && (() => { const tu = db.users.find(u => u.id === selTx.userId); const dir = txDirection(selTx.category, selTx.amount); return (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4 items-center"><span className="text-slate-500">Transaction ID</span><span className="flex items-center gap-1.5"><span className="font-bold font-mono text-right">{selTx.id}</span><button onClick={() => copyTxId(selTx.id)} title="Copy Transaction ID" className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600"><Copy size={13} /></button></span></div>
              {[['Customer', tu ? tu.name + ' · ' + tu.email : selTx.userId], ['Title', selTx.title], ['Category', selTx.category], ['Fee', usdt(selTx.fee)], ['Status', selTx.status], ['Method', selTx.method ?? '—'], ['Counterparty', selTx.counterparty ?? '—'], ['Note', selTx.note ?? '—'], ['IP address', selTx.ip ?? 'Not recorded'], ['Date', fmtDateTime(selTx.createdAt)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><span className="text-slate-500 capitalize">{k}</span><span className="font-bold text-right capitalize">{v}</span></div>
              ))}
              <div className="flex justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Amount</span><span className={`font-extrabold text-right ${txAmountCls(dir)}`}>{txSign(dir)}{usdt(Math.abs(selTx.amount))}</span></div>
            </div>
            {selTx.status === 'held' && (
              <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/25 p-3.5 text-sm font-semibold text-violet-700 dark:text-violet-300 flex gap-2.5"><Lock size={17} className="shrink-0 mt-0.5" /><span>This transaction is <b>on hold</b> — its amount ({usdt(Math.abs(selTx.amount))}) is locked in the customer's wallet and cannot be spent. Release the hold or cancel to reverse it.</span></div>
            )}
            {selTx.status === 'cancelled' && (
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/70 dark:border-rose-500/25 p-3.5 text-sm font-semibold text-rose-600 dark:text-rose-300 flex gap-2.5"><RotateCcw size={17} className="shrink-0 mt-0.5" /><span>This transaction was <b>cancelled and reversed</b> — its balance effect has been undone.</span></div>
            )}
            {(myScope === 'full' || myScope === 'finance') && (selTx.status === 'completed' || selTx.status === 'held') && (
              <div className="space-y-2">
                {selTx.status === 'completed' && <Btn variant="outline" className="w-full" onClick={async () => { const err = await txHold(selTx.id); if (err) return toast({ kind: 'error', title: err }); toast({ kind: 'success', title: 'Transaction held', body: 'The amount is now locked in the customer\'s wallet.' }) }}><Pause size={15} /> Hold transaction — lock the amount</Btn>}
                {selTx.status === 'held' && <Btn variant="success" className="w-full" onClick={async () => { const err = await txUnhold(selTx.id); if (err) return toast({ kind: 'error', title: err }); toast({ kind: 'success', title: 'Hold released', body: 'The amount is available to the customer again.' }) }}><Play size={15} /> Release hold (unhold)</Btn>}
                <Btn variant="danger" className="w-full" onClick={async () => { if (!txCancelArm) { setTxCancelArm(true); setTimeout(() => setTxCancelArm(false), 4000); return } const err = await txCancel(selTx.id); setTxCancelArm(false); if (err) return toast({ kind: 'error', title: err }); toast({ kind: 'success', title: 'Transaction cancelled & reversed' }) }}>{txCancelArm ? '⚠️ Tap again to confirm — reverse ' + usdt(Math.abs(selTx.amount)) + '?' : <><RotateCcw size={15} /> Cancel & reverse transaction</>}</Btn>
                <p className="text-[11px] text-slate-400 text-center">Hold locks the amount in the customer's Locked balance. Cancel fully reverses the transaction — for a send/receive, both sides are reversed together. The customer is notified either way.</p>
              </div>
            )}
            <Btn className="w-full" onClick={() => copyTxId(selTx.id)}><Copy size={15} /> Copy Transaction ID</Btn>
          </div>
        ) })()}
      </Modal>

      <Modal open={!!bannerForm} onClose={() => setBannerForm(null)} title={bannerForm?.id ? 'Edit banner' : 'Add banner'}>
        {bannerForm && (
          <div className="space-y-4">
            <div className={`rounded-3xl bg-gradient-to-br ${bannerForm.gradient} text-white p-4`}>
              <p className="font-extrabold">{bannerForm.title || 'Banner title'}</p>
              <p className="text-white/80 text-sm">{bannerForm.subtitle || 'Banner subtitle'}</p>
            </div>
            <Input label="Title" value={bannerForm.title} onChange={e => setBannerForm((b: any) => ({ ...b, title: e.target.value }))} />
            <Input label="Subtitle" value={bannerForm.subtitle} onChange={e => setBannerForm((b: any) => ({ ...b, subtitle: e.target.value }))} />
            <Select label="Colour theme" value={bannerForm.gradient} onChange={(e: any) => setBannerForm((b: any) => ({ ...b, gradient: e.target.value }))}>
              {[['from-violet-600 via-purple-600 to-indigo-600', 'Violet'], ['from-emerald-500 via-teal-500 to-cyan-600', 'Emerald'], ['from-amber-500 via-orange-500 to-rose-500', 'Sunset'], ['from-sky-500 via-blue-600 to-indigo-700', 'Ocean'], ['from-fuchsia-500 via-pink-500 to-rose-500', 'Pink'], ['from-rose-500 via-red-500 to-orange-500', 'Fire'], ['from-slate-700 via-slate-800 to-slate-900', 'Midnight']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!bannerForm.active} onChange={e => setBannerForm((b: any) => ({ ...b, active: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Show on the Home screen</label>
            <Btn className="w-full" onClick={() => { if (!bannerForm.title.trim()) return toast({ kind: 'error', title: 'Give the banner a title' }); saveBanner({ id: bannerForm.id, title: bannerForm.title.trim(), subtitle: bannerForm.subtitle.trim(), gradient: bannerForm.gradient, active: !!bannerForm.active }); setBannerForm(null); toast({ kind: 'success', title: 'Banner saved' }) }}>Save banner</Btn>
          </div>
        )}
      </Modal>
      <Modal open={!!newsForm} onClose={() => setNewsForm(null)} title={newsForm?.id ? 'Edit news' : 'Publish news'}>
        {newsForm && (
          <div className="space-y-4">
            <Input label="Title" value={newsForm.title} onChange={e => setNewsForm((n: any) => ({ ...n, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={newsForm.category} onChange={(e: any) => setNewsForm((n: any) => ({ ...n, category: e.target.value }))}>{['Bitcoin', 'Ethereum', 'Market Analysis', 'Blockchain', 'Trading'].map(c => <option key={c}>{c}</option>)}</Select>
              <Input label="Source" value={newsForm.source} onChange={e => setNewsForm((n: any) => ({ ...n, source: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Crypto logo shown on the card" value={newsForm.coin ?? 'NOVA'} onChange={(e: any) => setNewsForm((n: any) => ({ ...n, coin: e.target.value }))}>{['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'NOVA'].map(c => <option key={c} value={c}>{c === 'NOVA' ? 'NovaWallet logo' : c + ' logo'}</option>)}</Select>
            </div>
            <Input label="Excerpt" value={newsForm.excerpt} onChange={e => setNewsForm((n: any) => ({ ...n, excerpt: e.target.value }))} />
            <Input label="Body (paragraphs split by blank line)" value={newsForm.body} onChange={e => setNewsForm((n: any) => ({ ...n, body: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!newsForm.featured} onChange={e => setNewsForm((n: any) => ({ ...n, featured: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Featured story</label>
            <Btn className="w-full" onClick={() => { publishNews(newsForm); setNewsForm(null); toast({ kind: 'success', title: 'News saved' }) }}>Save news</Btn>
          </div>
        )}
      </Modal>
    </div>
  )
}


const SUP_TONE = (st: string) => st === 'pending' ? 'amber' : st === 'processing' ? 'violet' : 'green'

function SupportChat() {
  const { db } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const userOf = (id: string) => db.users.find(u => u.id === id)
  const list = db.tickets.filter(tk => {
    const u = userOf(tk.userId)
    const hay = `${u?.name ?? ''} @${u?.username ?? ''} ${u?.email ?? ''} ${tk.subject}`.toLowerCase()
    return (filter === 'all' || tk.status === filter) && hay.includes(q.trim().toLowerCase())
  }).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <Input placeholder="Search by username or email…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {['all', 'pending', 'processing', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold capitalize ${filter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}>{f}{f !== 'all' ? ` (${db.tickets.filter(t => t.status === f).length})` : ''}</button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-3">Tap a chat to open it full-page.</p>
      <div className="space-y-2">
        {list.length === 0 ? <Card><Empty title="No support chats" body="Nothing matches this search or filter." /></Card> : list.map(x => {
          const u = userOf(x.userId); const last = x.messages[x.messages.length - 1]
          return (
            <button key={x.id} onClick={() => navigate('/admin/support/' + x.id)} className="w-full text-left">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={u?.name ?? '?'} photo={u?.photo} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{x.subject}</p>
                    <p className="text-xs text-slate-400 truncate">{u?.name} · @{u?.username} · {u?.email}</p>
                    {last && <p className="text-xs text-slate-500 truncate mt-0.5">{last.from === 'admin' ? 'Support: ' : last.from === 'system' ? 'System: ' : ''}{last.text}</p>}
                    {last?.from === 'user' && (x.adminReadAt ?? '') < x.updatedAt && <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-1.5 align-middle" />}
                  </div>
                  <div className="text-right shrink-0"><Badge tone={SUP_TONE(x.status)}>{x.status}</Badge><p className="text-[10px] text-slate-400 mt-1">{fmtDateTime(x.updatedAt)}</p><p className="text-[10px] font-bold text-violet-500 mt-0.5 capitalize">{x.route ?? 'general'}{x.rating ? ' · ' + (x.rating === 'good' ? '👍' : '👎') : ''}</p></div>
                </div>
              </Card>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User details as a full PAGE (formerly the Manage modal): the identity
// card stays on top and every section lives behind its own menu entry,
// the same pattern as the full-page support chat.
const USER_SECTION_GROUPS = [
  { label: 'Money', items: [
    { id: 'adjust', label: 'Adjust balance', icon: Wallet },
    { id: 'trade', label: 'Crypto trade', icon: ArrowLeftRight },
    { id: 'locked', label: 'Locked holdings', icon: Lock },
    { id: 'money', label: 'Money history', icon: HandCoins },
    { id: 'statement', label: 'Statement', icon: ScrollText },
  ] },
  { label: 'Account', items: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'controls', label: 'Account controls', icon: SettingsIcon },
    { id: 'pin', label: 'PIN recovery', icon: ShieldCheck },
    { id: 'sessions', label: 'Sessions & devices', icon: Smartphone },
    { id: 'risk', label: 'Risk signals', icon: AlertTriangle },
  ] },
  { label: 'Communication', items: [
    { id: 'tickets', label: 'Support tickets', icon: MessageCircle },
    { id: 'emails', label: 'Email history', icon: Mail },
    { id: 'message', label: 'Send message', icon: Send },
    { id: 'notes', label: 'Notes & tags', icon: Tag },
  ] },
  { label: 'More', items: [
    { id: 'referrals', label: 'Referrals', icon: Gift },
    { id: 'activity', label: 'Activity log', icon: History },
  ] },
  { label: 'Control', items: [
    { id: 'control', label: 'Delete user', icon: Trash2 },
  ] },
] as const

const registrationCountryLabel = (code?: string) => {
  if (!code) return 'Not recorded'
  const cc = code.toUpperCase()
  try { return new (Intl as any).DisplayNames(['en'], { type: 'region' }).of(cc) + ' (' + cc + ')' } catch { return cc }
}

export function AdminUserPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user, db, decideUpgrade, setUserLevel, setUserStatus, adjustBalance, adminResetPin, setUserLoanLimit, adminBuyCrypto, adminSellCrypto, adminReleaseStake, adminClearLocked, setAdminScope, setAdminRole, txUnhold, decideDeposit, decideWithdraw, decideLoan, toast } = useApp()
  const usdt = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const byDateDesc = <T extends { createdAt: string }>(arr: T[]): T[] => [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const { coins } = useMarket(30_000)
  const priceOfA = (sym: string) => sym === 'USDT' ? 1 : coins.find(c => c.symbol === sym)?.priceUsd ?? 0
  const [section, setSection] = useState<string>('overview')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [extras, setExtras] = useState<any>(null)
  const [notesText, setNotesText] = useState(''); const [tagsSel, setTagsSel] = useState<string[]>([]); const [notesBusy, setNotesBusy] = useState(false)
  const [msgTitle, setMsgTitle] = useState(''); const [msgBody, setMsgBody] = useState(''); const [msgEmail, setMsgEmail] = useState(false); const [msgBusy, setMsgBusy] = useState(false)
  const suidOf = (rec: any) => rec?.fbUid ?? rec?.id ?? userId
  const loadExtras = () => { const rec = dbRefUsers(); apiGet('/v1/admin/user-extras?userId=' + suidOf(rec)).then(r => { if (r?.extras) { setExtras(r.extras); setNotesText(r.extras.notes ?? ''); setTagsSel(r.extras.tags ?? []) } }).catch(() => {}) }
  const dbRefUsers = () => db.users.find(x => x.id === userId)
  useEffect(() => { loadExtras() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [mAdjAmt, setMAdjAmt] = useState(''); const [mLoanLimit, setMLoanLimit] = useState('')
  const [mAdjDir, setMAdjDir] = useState<'add' | 'deduct'>('add'); const [mAdjTitle, setMAdjTitle] = useState('Charge'); const [mAdjNote, setMAdjNote] = useState('')
  const [mSym, setMSym] = useState('BTC'); const [mSide, setMSide] = useState<'buy' | 'sell'>('buy'); const [mTradeAmt, setMTradeAmt] = useState('')
  const [mClearArm, setMClearArm] = useState(false)
  const [mNewPin, setMNewPin] = useState(''); const [mPinArm, setMPinArm] = useState(false); const [mPinBusy, setMPinBusy] = useState(false)
  const [delText, setDelText] = useState(''); const [delBusy, setDelBusy] = useState(false)
  const u = db.users.find(x => x.id === userId) ?? null
  useEffect(() => { setMLoanLimit(u?.loanLimitOverride ? String(Math.round(u.loanLimitOverride / db.settings.bdtPerUsd * 100) / 100) : '') }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
  const copyTxId = async (id: string) => { try { await navigator.clipboard.writeText(id); toast({ kind: 'success', title: 'Copied', body: id }) } catch { toast({ kind: 'error', title: 'Copy failed', body: id }) } }
  const myScope = user?.adminScope ?? 'full'
  if (!user) return null
  if (!u) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button onClick={() => navigate('/admin?tab=users')} className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 mb-6"><ArrowLeft size={16} /> Back to Users</button>
        <Empty title="User not found" body="This account may still be loading — go back and try again in a moment." />
      </div>
    </div>
  )

          const lvlDef = db.levels.find(l => l.level === u.level)
          const pendingReq = db.levelRequests.find(r => r.userId === u.id && r.status === 'pending')
          const sw = db.wallets.find(x => x.userId === u.id) ?? null
          const holdings = Object.entries(sw?.holdings ?? {}).filter(([, a]) => a > 0)
          const cryptoValueBdt = holdings.reduce((sum, [sym, a]) => sum + a * priceOfA(sym) * db.settings.bdtPerUsd, 0)
          const stakes = db.stakes.filter(st => st.userId === u.id && st.status === 'active')
          const pendWd = db.withdrawals.filter(x => x.userId === u.id && x.status === 'pending')
          const heldTxs = byDateDesc(db.txs.filter(t => t.userId === u.id && t.status === 'held'))
          // A held SEND locks its money in the RECIPIENT's account, not in
          // this user's locked balance — keep it out of this user's sum.
          const selSuid = u.fbUid ?? u.id
          const isPairSend = (t: (typeof heldTxs)[number]) => t.category === 'send' && db.txs.some(x => x.category === 'receive' && x.status === 'held' && x.counterparty === selSuid && Math.abs(x.amount) === Math.abs(t.amount))
          const heldSum = heldTxs.filter(t => !isPairSend(t)).reduce((a, t) => a + Math.abs(t.amount), 0)
          const stmt = byDateDesc(db.txs.filter(t => t.userId === u.id)).slice(0, 25)
          const pinLocked = !!u.pinLockedUntil && new Date(u.pinLockedUntil).getTime() > Date.now()
          const ADJ_TITLES = ['Charge', 'Complaint', 'Hold', 'Refund', 'Bonus', 'Compensation', 'Correction']
          const tradePrice = priceOfA(mSym)
          const sellHolding = sw?.holdings[mSym] ?? 0
          const totalWealth = (sw?.available ?? 0) + (sw?.locked ?? 0) + cryptoValueBdt

  return (
    <div>
      {/* Sub-header sticks UNDER the AdminShell admin bar (top-16) — this page
          lives inside the admin chrome, not the customer Layout. */}
      <header className="sticky top-16 z-20 mb-4 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800">
        <div className="h-14 flex items-center gap-3">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open sections menu" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Menu size={18} /></button>
          <button onClick={() => navigate('/admin?tab=users')} aria-label="Back to Users" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={18} /></button>
          <h1 className="font-extrabold text-lg truncate">User details</h1>
        </div>
      </header>
      <main className="space-y-4">
{/* Header */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 p-4 text-white shadow-lg shadow-violet-600/25">
                <div className="flex items-center gap-3.5">
                  <span className="rounded-full ring-2 ring-white/40 shrink-0"><Avatar name={u.name} photo={u.photo} size={52} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-lg leading-tight truncate">{u.name}</p>
                    <p className="text-white/75 text-xs font-semibold truncate">@{u.username} · {u.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-extrabold">Level {u.level}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-extrabold capitalize">{u.status}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-extrabold">{u.kyc === 'verified' ? '✅ KYC verified' : u.kyc === 'pending' ? '⏳ KYC pending' : 'KYC unverified'}</span>
                      {u.registrationCountry && <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-extrabold">🌍 {registrationCountryLabel(u.registrationCountry)}</span>}
                      {u.role === 'admin' && <span className="px-2 py-0.5 rounded-full bg-amber-300 text-amber-900 text-[11px] font-extrabold capitalize">🛡️ Admin · {u.adminScope ?? 'full'}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 rounded-2xl bg-black/25 px-3.5 py-2.5 flex items-end justify-between gap-3">
                  <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Total balance · incl. locked + crypto</p><p className="font-extrabold text-xl leading-tight truncate">{usdt(totalWealth)}</p></div>
                  <p className="text-[11px] font-semibold text-white/60 text-right shrink-0">Joined<br /><span className="text-white/85">{fmtDateTime(u.createdAt)}</span></p>
                </div>
              </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-extrabold">Sections</p>
                <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="p-2 rounded-full bg-slate-100 dark:bg-slate-800"><X size={16} /></button>
              </div>
              {USER_SECTION_GROUPS.map(g => (
                <div key={g.label} className="mt-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-2 mb-1.5">{g.label}</p>
                  <div className="space-y-1">
                    {g.items.map(sec => (
                      <button key={sec.id} onClick={() => { setSection(sec.id); setDrawerOpen(false) }} className={'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-bold text-left transition active:scale-[0.98] ' + (section === sec.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                        <sec.icon size={16} /> {sec.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="flex-1 min-w-0 space-y-4">
            {section === 'overview' && (<>
{/* Balance cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Wallet size={13} /> Available cash</p>
                  <p className="font-extrabold text-lg mt-1">{usdt(sw?.available ?? 0)}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">Spendable right now</p>
                </div>
                <div className={`rounded-3xl border p-3.5 ${(sw?.locked ?? 0) > 0 ? 'border-violet-300/70 dark:border-violet-500/30 bg-violet-50/70 dark:bg-violet-500/5' : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Lock size={13} /> Locked</p>
                  <p className="font-extrabold text-lg mt-1">{usdt(sw?.locked ?? 0)}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">Stakes · cash-outs · holds</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Available incl. USDT</p>
                  <p className="font-extrabold text-lg mt-1">{usdt((sw?.available ?? 0) + (sw?.holdings.USDT ?? 0) * db.settings.bdtPerUsd)}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">The customer's Home figure</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Crypto value (live)</p>
                  <p className="font-extrabold text-lg mt-1">{usdt(cryptoValueBdt)}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">{holdings.length} asset{holdings.length === 1 ? '' : 's'} held</p>
                </div>
              </div>
              {holdings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 -mt-1">
                  {holdings.map(([sym, a]) => (
                    <span key={sym} className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-extrabold">{sym} · {a} <span className="text-slate-400 font-bold">({fmtUSDT(a * priceOfA(sym))})</span></span>
                  ))}
                </div>
              )}
              {/* Details */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 text-sm space-y-2">
                <div className="flex justify-between items-center gap-3"><span className="text-slate-500">User ID</span><span className="flex items-center gap-1.5"><span className="font-bold font-mono text-[13px]">{u.id}</span><button onClick={() => copyTxId(u.id)} title="Copy user ID" className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600"><Copy size={12} /></button></span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="font-bold">{u.phone}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Email</span><span className="font-bold truncate">{u.email}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Registration country</span><span className="font-bold text-right">{registrationCountryLabel(u.registrationCountry)}</span></div>
              </div>
              {/* KYC status — data lives in the KYC Verification tab */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 text-sm flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-bold"><ShieldCheck size={17} className="text-violet-500" /> KYC status</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold">{u.kyc === 'verified' ? '✅ Verified' : u.kyc === 'pending' ? '⏳ Pending review' : 'Not verified'}</span>
                  {u.kyc === 'pending' && <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => { navigate('/admin?tab=kyc&kycfocus=' + u.id) }}>Review in KYC tab →</Btn>}
                </span>
              </div>
            </>)}
            {section === 'adjust' && (<>
{/* Titled balance adjustment */}
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/60 p-4">
                <p className="font-extrabold text-sm">💰 Adjust balance <span className="text-slate-400 font-semibold">— shows in the statement with your title</span></p>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-3">
                  {([['add', '＋ Add money'], ['deduct', '− Deduct']] as const).map(([d, l]) => (
                    <button key={d} onClick={() => setMAdjDir(d)} className={`py-2 rounded-xl text-sm font-bold transition ${mAdjDir === d ? 'bg-white dark:bg-slate-900 shadow ' + (d === 'add' ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-500'}`}>{l}</button>
                  ))}
                </div>
                <p className="text-xs font-bold text-slate-400 mt-3.5 mb-1.5">TITLE (appears in the customer's statement)</p>
                <div className="flex flex-wrap gap-1.5">
                  {ADJ_TITLES.map(tl => (
                    <button key={tl} onClick={() => setMAdjTitle(tl)} className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition ${mAdjTitle === tl ? 'bg-violet-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{tl}</button>
                  ))}
                </div>
                <div className="space-y-3 mt-3">
                  <Input label="…or a custom title" value={mAdjTitle} onChange={e => setMAdjTitle(e.target.value)} />
                  <Input label={'Amount (USDT) — ' + (mAdjDir === 'add' ? 'added to Available' : 'deducted from Available')} type="number" value={mAdjAmt} onChange={e => setMAdjAmt(e.target.value)} />
                  {Number(mAdjAmt) > 0 && <p className={`text-xs font-bold -mt-1 ${mAdjDir === 'add' ? 'text-emerald-600' : 'text-rose-500'}`}>{mAdjDir === 'add' ? '+' : '−'}≈ ৳{Math.round(Number(mAdjAmt) * db.settings.bdtPerUsd).toLocaleString('en-US')} {mAdjDir === 'add' ? 'will be added to' : 'will be deducted from'} the cash balance (available now: {usdt(sw?.available ?? 0)})</p>}
                  <Input label="Note (optional)" placeholder="e.g. Support ticket #123 — service charge" value={mAdjNote} onChange={e => setMAdjNote(e.target.value)} />
                  <Btn variant={mAdjDir === 'add' ? 'success' : 'danger'} className="w-full" onClick={() => { const a = Number(mAdjAmt); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter an amount' }); if (!mAdjTitle.trim()) return toast({ kind: 'error', title: 'A title is required — it appears in the statement' }); if (mAdjDir === 'deduct' && Math.round(a * db.settings.bdtPerUsd) > (sw?.available ?? 0)) return toast({ kind: 'error', title: 'Deduction exceeds the available balance' }); adjustBalance(u.id, (mAdjDir === 'add' ? 1 : -1) * Math.round(a * db.settings.bdtPerUsd), mAdjTitle.trim(), mAdjNote.trim() || undefined); setMAdjAmt(''); setMAdjNote(''); toast({ kind: 'success', title: (mAdjDir === 'add' ? 'Added' : 'Deducted') + ' — recorded in the statement as “' + mAdjTitle.trim() + '”' }) }}>{mAdjDir === 'add' ? '＋ Add' : '− Deduct'} — statement title: {mAdjTitle.trim() || '…'}</Btn>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Writes a statement entry with this exact title + an audit log line, and notifies the customer. A deduction shows as a red − amount in the customer's statement.</p>
              </div>
            </>)}
            {section === 'trade' && (<>
{/* Support crypto trade */}
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/60 p-4">
                <p className="font-extrabold text-sm">Crypto buy / sell <span className="text-slate-400 font-semibold">— on the customer's behalf</span></p>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-3">
                  {([['buy', 'Buy'], ['sell', 'Sell']] as const).map(([sd, l]) => (
                    <button key={sd} onClick={() => setMSide(sd)} className={`py-2 rounded-xl text-sm font-bold transition ${mSide === sd ? 'bg-white dark:bg-slate-900 shadow ' + (sd === 'buy' ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-500'}`}>{l}</button>
                  ))}
                </div>
                <div className="space-y-3 mt-3">
                  <Select label="Coin" value={mSym} onChange={(e: any) => setMSym(e.target.value)}>
                    {Object.keys(COIN_META).map(sym => <option key={sym} value={sym}>{sym} — {COIN_META[sym].name}</option>)}
                  </Select>
                  <p className="text-xs text-slate-400 -mt-1">Live price: <b className="text-slate-600 dark:text-slate-200">{mSym === 'USDT' ? '$1.00 (pegged)' : fmtPrice(tradePrice)}</b> · Customer holds <b className="text-slate-600 dark:text-slate-200">{sellHolding} {mSym}</b></p>
                  <div className="relative">
                    <Input label={mSide === 'buy' ? 'Spend (USDT)' : 'Amount (' + mSym + ')'} type="number" value={mTradeAmt} onChange={e => setMTradeAmt(e.target.value)} />
                    {mSide === 'sell' && sellHolding > 0 && <button onClick={() => setMTradeAmt(String(sellHolding))} className="absolute right-3 top-[34px] text-xs font-extrabold text-violet-600">MAX</button>}
                  </div>
                  {mSide === 'buy' && Number(mTradeAmt) > 0 && tradePrice > 0 && <p className="text-xs font-bold text-emerald-600 -mt-1">≈ receives {(Number(mTradeAmt) / tradePrice).toFixed(6)} {mSym}</p>}
                  {mSide === 'sell' && Number(mTradeAmt) > 0 && <p className="text-xs font-bold text-rose-500 -mt-1">≈ receives {fmtUSDT(Number(mTradeAmt) * tradePrice)} {mSym === 'USDT' ? '(to cash balance)' : '(to USDT holding)'}</p>}
                  <Btn className="w-full" onClick={async () => { const a = Number(mTradeAmt); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter an amount' }); const err = mSide === 'buy' ? await adminBuyCrypto(u.id, mSym, a, tradePrice) : await adminSellCrypto(u.id, mSym, a, tradePrice); if (err) return toast({ kind: 'error', title: err }); setMTradeAmt(''); toast({ kind: 'success', title: (mSide === 'buy' ? 'Bought ' : 'Sold ') + mSym + ' for ' + u.name }) }}>{mSide === 'buy' ? 'Buy' : 'Sell'} {mSym} for customer</Btn>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Uses the customer's own balances (USDT holding first, cash covers the rest — same as their own trades). Audited + the customer is notified.</p>
              </div>
            </>)}
            {section === 'locked' && (<>
{/* Locked manager */}
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/60 p-4">
                <p className="font-extrabold text-sm">🔒 Locked holdings <span className="text-slate-400 font-semibold">— total {usdt(sw?.locked ?? 0)}</span></p>
                <div className="space-y-2 mt-3">
                  {heldTxs.map(tx => (
                    <div key={tx.id} className="flex items-center gap-2.5 rounded-2xl bg-violet-50 dark:bg-violet-500/10 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>{isPairSend(tx) ? '⏸ Sent transfer on hold — locked at the recipient' : '⏸ Transaction on hold'}</b> <span className="text-slate-400 text-xs block truncate">{tx.title} · {tx.id} · {fmtDateTime(tx.createdAt)}</span></span>
                      <b className="text-sm">{usdt(Math.abs(tx.amount))}</b>
                      <Btn variant="outline" className="!py-1.5 !text-xs" onClick={async () => { const err = await txUnhold(tx.id); if (err) return toast({ kind: 'error', title: err }); toast({ kind: 'success', title: 'Hold released to Available' }) }}>Unhold</Btn>
                    </div>
                  ))}
                  {stakes.map(st => (
                    <div key={st.id} className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>🌱 Stake</b> <span className="text-slate-400 text-xs block">{st.apy}% APY · {st.termDays === 0 ? 'Flexible' : st.termDays + ' days'} · since {fmtDateTime(st.startAt)}</span></span>
                      <b className="text-sm">{usdt(st.amount)}</b>
                      <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => { adminReleaseStake(u.id, st.id); toast({ kind: 'success', title: 'Stake released to Available' }) }}>Release</Btn>
                    </div>
                  ))}
                  {pendWd.map(x => (
                    <div key={x.id} className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>⏳ Cash Out pending</b> <span className="text-slate-400 text-xs block">{x.method} → {x.destination} · approve/reject it in Finance</span></span>
                      <b className="text-sm">{usdt(x.amount)}</b>
                    </div>
                  ))}
                  {(() => { const rem = (sw?.locked ?? 0) - stakes.reduce((a, st) => a + st.amount, 0) - pendWd.reduce((a, x) => a + x.amount, 0) - heldSum; return rem > 0 ? (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>🔒 Other holds</b> <span className="text-slate-400 text-xs block">No stake, hold or cash-out record behind this part (platform / legacy hold) — Clear ALL below releases it.</span></span>
                      <b className="text-sm">{usdt(rem)}</b>
                    </div>) : null })()}
                  {stakes.length === 0 && pendWd.length === 0 && heldTxs.length === 0 && (sw?.locked ?? 0) === 0 && <p className="text-sm text-slate-400">Nothing locked for this customer.</p>}
                  {stakes.length === 0 && pendWd.length === 0 && heldTxs.length === 0 && (sw?.locked ?? 0) > 0 && <p className="text-sm text-slate-400">This locked amount has no stake, hold or cash-out record (legacy/other hold) — Clear all releases it.</p>}
                </div>
                {(sw?.locked ?? 0) > 0 && (
                  <Btn variant="danger" className="w-full mt-3" onClick={() => { if (!mClearArm) { setMClearArm(true); setTimeout(() => setMClearArm(false), 4000); return } adminClearLocked(u.id); setMClearArm(false); toast({ kind: 'success', title: 'All locked holdings cleared to Available' }) }}>{mClearArm ? '⚠️ Tap again to confirm — release ALL ' + usdt(sw?.locked ?? 0) + '?' : 'Clear ALL locked holdings'}</Btn>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">Clear-all closes every stake (no interest on a bulk clear — release stakes one by one above to pay interest), cancels pending cash outs, releases transaction holds, and moves the whole locked amount to Available. Audited + notified.</p>
              </div>
            </>)}
            {section === 'controls' && (<>
{/* Account controls */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3.5">
                <p className="font-extrabold text-sm">Account controls</p>
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1.5">ACCOUNT LEVEL</p>
                  <select value={u.level} onChange={e => { setUserLevel(u.id, Number(e.target.value)); toast({ kind: 'success', title: u.name + ' → Level ' + e.target.value }) }} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-bold">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Level {n}</option>)}
                  </select>
                  {pendingReq && (
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 p-3">
                      <p className="flex-1 min-w-[140px] text-xs font-bold text-amber-700 dark:text-amber-300">Upgrade request pending: Level {pendingReq.fromLevel} → Level {pendingReq.toLevel}</p>
                      <Btn variant="success" className="!py-1.5 !text-xs" onClick={() => decideUpgrade(pendingReq.id, true)}>Approve</Btn>
                      <Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideUpgrade(pendingReq.id, false)}>Reject</Btn>
                    </div>
                  )}
                </div>
                {u.role === 'user' && (
                  <div className="flex flex-wrap gap-2">
                    {u.status !== 'frozen' ? <Btn variant="outline" className="!py-2 !text-xs flex-1" onClick={() => setUserStatus(u.id, 'frozen')}>❄️ Freeze wallet</Btn> : <Btn variant="outline" className="!py-2 !text-xs flex-1" onClick={() => setUserStatus(u.id, 'active')}>Unfreeze wallet</Btn>}
                    {u.status !== 'suspended' ? <Btn variant="danger" className="!py-2 !text-xs flex-1" onClick={() => setUserStatus(u.id, 'suspended')}>Suspend account</Btn> : <Btn variant="success" className="!py-2 !text-xs flex-1" onClick={() => setUserStatus(u.id, 'active')}>Activate account</Btn>}
                  </div>
                )}
              </div>
              {/* Admin access (RBAC) — only the owner (full scope) can grant
                  or change admin roles; the server enforces the scopes. */}
              {myScope === 'full' && u.id !== user?.id && (
                <div className="rounded-3xl border border-amber-200/70 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 p-4">
                  <p className="font-extrabold text-sm mb-1">🛡️ Admin access</p>
                  <p className="text-xs text-slate-400 mb-3">Scopes decide what a teammate can see and do — Finance approves money, Content manages news & broadcasts, Support handles KYC & chats. Full = owner access.</p>
                  {u.role !== 'admin' ? (
                    <Btn variant="outline" className="!py-2 !text-xs" onClick={() => { setAdminRole(u.id, 'admin'); toast({ kind: 'success', title: 'Admin access granted', body: u.name + ' is now an admin (Support scope to start — widen it here anytime).' }) }}>Make admin</Btn>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {(['full', 'finance', 'content', 'support'] as const).map(sc => (
                          <button key={sc} onClick={() => setAdminScope(u.id, sc)} className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition active:scale-95 ${(u.adminScope ?? 'full') === sc ? 'bg-violet-600 text-white shadow' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}>{sc === 'full' ? 'Full (Owner)' : sc}</button>
                        ))}
                      </div>
                      <Btn variant="danger" className="!py-2 !text-xs" onClick={() => { setAdminRole(u.id, 'user'); toast({ kind: 'info', title: 'Admin access removed', body: u.name + ' is a regular user again.' }) }}>Remove admin access</Btn>
                    </div>
                  )}
                </div>
              )}
              {u.role === 'admin' && myScope !== 'full' && (
                <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 text-sm flex justify-between"><span className="text-slate-500">Admin scope</span><span className="font-bold capitalize">{u.adminScope ?? 'full'}</span></div>
              )}
{/* Loan limit */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="font-extrabold text-sm mb-2">Loan limit</p>
                <p className="text-xs text-slate-400 mb-2">Level {u.level} default: <b>{usdt(lvlDef?.loanLimit ?? 0)}</b> · Current: <b>{u.loanLimitOverride ? usdt(u.loanLimitOverride) + ' (custom)' : 'level default'}</b></p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><Input label="Personal loan limit (USDT)" type="number" value={mLoanLimit} onChange={e => setMLoanLimit(e.target.value)} /></div>
                  <Btn className="!py-3" onClick={() => { const a = Number(mLoanLimit); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter a loan limit' }); setUserLoanLimit(u.id, Math.round(a * db.settings.bdtPerUsd)); toast({ kind: 'success', title: 'Loan limit updated' }) }}>Save</Btn>
                </div>
                {u.loanLimitOverride ? <Btn variant="ghost" className="!py-1.5 !text-xs mt-1" onClick={() => { setUserLoanLimit(u.id, null); setMLoanLimit(''); toast({ kind: 'success', title: 'Loan limit reset to level default' }) }}>Reset to level default</Btn> : null}
              </div>
            </>)}
            {section === 'pin' && (<>
{/* Transaction PIN recovery */}
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4">
                <p className="font-extrabold text-sm mb-2">Transaction PIN</p>
                <p className="text-xs text-slate-400 mb-2">{pinLocked ? <>🔒 <b className="text-rose-500">Locked until {fmtDateTime(u.pinLockedUntil!)}</b> — too many wrong attempts.</> : (u.pinFailCount ?? 0) > 0 ? <>Active · {u.pinFailCount} failed attempt{(u.pinFailCount ?? 0) === 1 ? '' : 's'} on record.</> : 'Active · no failed attempts.'}</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><Input label="New PIN (4 digits)" inputMode="numeric" maxLength={4} placeholder="••••" value={mNewPin} onChange={e => { setMNewPin(e.target.value.replace(/\D/g, '')); setMPinArm(false) }} /></div>
                  <Btn className="!py-3" variant={mPinArm ? 'danger' : 'primary'} disabled={mNewPin.length !== 4 || mPinBusy} onClick={async () => { if (!mPinArm) { setMPinArm(true); setTimeout(() => setMPinArm(false), 4000); return } setMPinBusy(true); try { const e = await adminResetPin(u.id, mNewPin); if (e) { toast({ kind: 'error', title: e }); return } setMNewPin(''); setMPinArm(false); toast({ kind: 'success', title: 'PIN reset for ' + u.name, body: 'The user was notified in-app and by email. Tell them the new PIN after verifying their identity.' }) } finally { setMPinBusy(false) } }}>{mPinBusy ? <Loader2 size={16} className="animate-spin" /> : mPinArm ? '⚠️ Confirm reset' : 'Reset PIN'}</Btn>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">PIN recovery for users who forgot theirs — the PIN can never be changed inside the app. Setting a new PIN also clears the failed-attempt count and any lock. Audited + notified.</p>
              </div>
            </>)}
            {section === 'statement' && (<>
{/* Statement */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-extrabold text-sm">Statement <span className="text-slate-400 font-semibold">— latest activity · tap a row for details, hold & cancel</span></p>
                <Btn variant="outline" className="!py-1.5 !text-xs shrink-0" onClick={() => { const rows = byDateDesc(db.txs.filter(t => t.userId === u.id)); if (!rows.length) return toast({ kind: 'error', title: 'Nothing to export yet' }); const csv = [['Date', 'Transaction ID', 'Title', 'Category', 'Amount (BDT)', 'Status'].join(','), ...rows.map(t => [new Date(t.createdAt).toISOString(), t.id, '"' + String(t.title).replace(/"/g, '""') + '"', t.category, t.amount, t.status].join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'statement-' + u.username + '.csv'; a.click(); URL.revokeObjectURL(a.href) }}><Download size={13} /> Export CSV</Btn>
              </div>
                {stmt.length === 0 ? <p className="text-sm text-slate-400">No transactions yet.</p> : (
                  <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {stmt.map(tx => { const dir = txDirection(tx.category, tx.amount); return (
                      <button key={tx.id} onClick={() => { navigate('/admin?tx=' + tx.id) }} title="Open transaction details" className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <TxDirIcon dir={dir} />
                        <span className="flex-1 min-w-0"><span className="block font-bold text-[13px] truncate">{tx.title}</span><span className="block text-[11px] text-slate-400 truncate">{tx.id} · {fmtDateTime(tx.createdAt)}{tx.note ? ' · ' + tx.note : ''}</span></span>
                        <span className="text-right"><span className={`block font-extrabold text-[13px] ${txAmountCls(dir)}`}>{txSign(dir)}{usdt(Math.abs(tx.amount))}</span><Badge tone={statusTone(tx.status)}>{tx.status}</Badge></span>
                      </button>
                    ) })}
                  </div>
                )}
              </div>
            </>)}
            {section === 'money' && (() => {
              const deps = byDateDesc(db.deposits.filter(d => d.userId === u.id))
              const wds = byDateDesc(db.withdrawals.filter(d => d.userId === u.id))
              const lns = byDateDesc(db.loans.filter(d => d.userId === u.id))
              const empty = deps.length === 0 && wds.length === 0 && lns.length === 0
              return (
                <div className="space-y-5">
                  {empty && <p className="text-sm text-slate-400">No deposits, withdrawals or loans yet.</p>}
                  {deps.length > 0 && (<section>
                    <h3 className="font-extrabold mb-2 text-sm">Deposits</h3>
                    <div className="space-y-2">{deps.map(d => (
                      <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4">
                        <div className="flex-1 min-w-[170px]"><p className="font-bold text-sm">{usdt(d.amount)} · {d.method}</p><p className="text-xs text-slate-400">{d.id} · TrxID {d.trxId} · {fmtDateTime(d.createdAt)}</p></div>
                        <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                        {d.status === 'pending' && <><Btn variant="success" className="!py-1.5 !text-xs" onClick={() => decideDeposit(d.id, true)}>Approve</Btn><Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideDeposit(d.id, false)}>Reject</Btn></>}
                      </div>))}
                    </div>
                  </section>)}
                  {wds.length > 0 && (<section>
                    <h3 className="font-extrabold mb-2 text-sm">Withdrawals / Cash Out</h3>
                    <div className="space-y-2">{wds.map(d => (
                      <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4">
                        <div className="flex-1 min-w-[170px]"><p className="font-bold text-sm">{usdt(d.amount)} · {d.method}</p><p className="text-xs text-slate-400">{d.id} → {d.destination} · fee {usdt(d.fee)} · {fmtDateTime(d.createdAt)}</p></div>
                        <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                        {d.status === 'pending' && <><Btn variant="success" className="!py-1.5 !text-xs" onClick={() => decideWithdraw(d.id, true)}>Complete</Btn><Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideWithdraw(d.id, false)}>Reject</Btn></>}
                      </div>))}
                    </div>
                  </section>)}
                  {lns.length > 0 && (<section>
                    <h3 className="font-extrabold mb-2 text-sm">Loans</h3>
                    <div className="space-y-2">{lns.map(l => (
                      <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4">
                        <div className="flex-1 min-w-[170px]"><p className="font-bold text-sm">{usdt(l.amount)} · {l.months} months · {l.ratePct}%</p><p className="text-xs text-slate-400">{l.id} · EMI {usdt(l.emi)} · paid {usdt(l.paid)} of {usdt(l.totalPayable)} · {fmtDateTime(l.createdAt)}</p></div>
                        <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                        {l.status === 'pending' && <><Btn variant="success" className="!py-1.5 !text-xs" onClick={() => decideLoan(l.id, true)}>Approve & disburse</Btn><Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideLoan(l.id, false)}>Reject</Btn></>}
                      </div>))}
                    </div>
                  </section>)}
                </div>
              )
            })()}
            {section === 'tickets' && (
              <div className="space-y-2">
                {byDateDesc(db.tickets.filter(t => t.userId === u.id)).length === 0 ? <p className="text-sm text-slate-400">No support chats yet.</p> : byDateDesc(db.tickets.filter(t => t.userId === u.id)).map(t => (
                  <button key={t.id} onClick={() => navigate('/admin/support/' + t.id)} className="w-full flex items-center gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-violet-300 transition">
                    <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{t.subject}</span><span className="block text-xs text-slate-400 mt-0.5">{t.id} · {fmtDateTime(t.updatedAt ?? t.createdAt)}</span></span>
                    {t.rating ? <span>{t.rating === 'up' ? '👍' : t.rating === 'down' ? '👎' : t.rating}</span> : null}
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </button>
                ))}
              </div>
            )}
            {section === 'sessions' && (
              <div className="space-y-2">
                {!extras ? <p className="text-sm text-slate-400">Loading sessions…</p> : extras.sessions.length === 0 ? <p className="text-sm text-slate-400">No sessions recorded for this user.</p> : extras.sessions.map((x: any) => (
                  <div key={x.id} className="flex items-center gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <Smartphone size={18} className="text-slate-400 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm"><b className="block truncate">{x.device || 'Unknown device'}</b><span className="text-xs text-slate-400 block truncate">{x.ip || 'IP not recorded'} · signed in {fmtDateTime(x.createdAt)}{x.lastSeenAt ? ' · last seen ' + fmtDateTime(x.lastSeenAt) : ''}</span></span>
                    {x.revoked ? <Badge tone="red">revoked</Badge> : <Btn variant="danger" className="!py-1.5 !text-xs" onClick={async () => { try { await apiPost('/v1/admin/sessions/revoke', { sessionId: x.id }) } catch { /* reload anyway */ } loadExtras(); toast({ kind: 'success', title: 'Session revoked' }) }}>Revoke</Btn>}
                  </div>
                ))}
                <p className="text-[11px] text-slate-400">Revoking a session signs that device out on its next request.</p>
              </div>
            )}
            {section === 'risk' && (() => {
              const openTickets = db.tickets.filter(t => t.userId === u.id && t.status !== 'resolved').length
              const distinctIps = extras ? new Set(extras.sessions.map((x: any) => x.ip).filter(Boolean)).size : 0
              const ageDays = Math.max(0, Math.floor((Date.now() - new Date(u.createdAt).getTime()) / 86400000))
              const rows: [string, string, boolean][] = [
                ['Transaction PIN', pinLocked ? 'Locked — too many wrong attempts' : (u.pinFailCount ?? 0) > 0 ? (u.pinFailCount + ' failed attempt' + ((u.pinFailCount ?? 0) === 1 ? '' : 's')) : 'No failed attempts', pinLocked || (u.pinFailCount ?? 0) >= 3],
                ['Sessions', extras ? extras.sessions.filter((x: any) => !x.revoked).length + ' active · ' + distinctIps + ' different IP' + (distinctIps === 1 ? '' : 's') : 'Loading…', false],
                ['Accounts sharing an IP', extras ? (extras.sameIpUsers.length ? extras.sameIpUsers.map((x: any) => (x.name || '@' + x.username)).join(', ') : 'None') : 'Loading…', !!extras && extras.sameIpUsers.length > 0],
                ['Verification codes sent (7 days)', extras ? String(extras.otpCount7d) : 'Loading…', !!extras && extras.otpCount7d > 10],
                ['Transactions on hold', String(heldTxs.length), heldTxs.length > 0],
                ['Open support chats', String(openTickets), false],
                ['Account age', ageDays + ' day' + (ageDays === 1 ? '' : 's'), false],
              ]
              return (
                <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 text-sm">
                  {rows.map(([label, value, warn]) => (
                    <div key={label} className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><span className={'font-bold text-right ' + (warn ? 'text-amber-600 dark:text-amber-400' : '')}>{warn ? '⚠️ ' : ''}{value}</span></div>
                  ))}
                  <p className="text-[11px] text-slate-400 pt-1">Signals only — a shared IP can be a family or office network, and holds may be yours. Judge before acting.</p>
                </div>
              )
            })()}
            {section === 'emails' && (
              <div className="space-y-2">
                {!extras ? <p className="text-sm text-slate-400">Loading emails…</p> : extras.emails.length === 0 ? <p className="text-sm text-slate-400">No emails have been sent to this user yet.</p> : extras.emails.map((e: any) => (
                  <div key={e.id} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm">
                    <div className="flex items-center gap-2"><b className="flex-1 min-w-0 truncate">{e.subject}</b><Badge tone={e.status === 'sent' ? 'green' : 'red'}>{e.status}</Badge></div>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{e.kind} · {fmtDateTime(e.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            {section === 'message' && (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <p className="font-extrabold text-sm">Send a direct message</p>
                <Input label="Title" value={msgTitle} onChange={e => setMsgTitle(e.target.value)} />
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-1.5">MESSAGE</p>
                  <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={4} placeholder="Write the message…" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={msgEmail} onChange={e => setMsgEmail(e.target.checked)} className="accent-violet-600 w-4 h-4" /> Also send by email</label>
                <Btn className="w-full" disabled={msgBusy || !msgTitle.trim() || !msgBody.trim()} onClick={async () => { setMsgBusy(true); try { await apiPost('/v1/admin/user-message', { userId: suidOf(u), title: msgTitle.trim(), body: msgBody.trim(), email: msgEmail }); setMsgTitle(''); setMsgBody(''); toast({ kind: 'success', title: 'Message sent to ' + u.name }) } catch (e: any) { toast({ kind: 'error', title: e.message || 'Sending failed' }) } setMsgBusy(false) }}>{msgBusy ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> Send message</>}</Btn>
                <p className="text-[11px] text-slate-400">Delivered as an in-app notification{msgEmail ? ' and by email' : ''}. The send is written to the audit log.</p>
              </div>
            )}
            {section === 'notes' && (
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <p className="font-extrabold text-sm flex items-center gap-2"><Tag size={15} className="text-violet-500" /> Admin notes & tags <span className="text-slate-400 font-semibold">— only admins see these</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {['VIP', 'Watch', 'Fraud risk', 'Priority support', 'New user'].map(tg => (
                    <button key={tg} onClick={() => setTagsSel(prev => prev.includes(tg) ? prev.filter(x => x !== tg) : [...prev, tg])} className={'px-3 py-1.5 rounded-full text-xs font-extrabold transition ' + (tagsSel.includes(tg) ? 'bg-violet-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}>{tg}</button>
                  ))}
                </div>
                <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={5} placeholder="Private notes about this customer…" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-violet-500" />
                <Btn className="w-full" disabled={notesBusy || !extras} onClick={async () => { setNotesBusy(true); try { await apiPost('/v1/admin/user-notes', { userId: suidOf(u), notes: notesText, tags: tagsSel }); toast({ kind: 'success', title: 'Notes saved' }) } catch (e: any) { toast({ kind: 'error', title: e.message || 'Saving failed' }) } setNotesBusy(false) }}>{notesBusy ? <Loader2 size={16} className="animate-spin" /> : 'Save notes & tags'}</Btn>
              </div>
            )}
            {section === 'referrals' && (
              <div className="space-y-2">
                <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm space-y-2">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Referral code</span><b>{u.referralCode}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Referred by</span>{extras?.referredBy ? <button className="font-bold text-violet-600" onClick={() => navigate('/admin/users/' + extras.referredBy.id)}>{extras.referredBy.name || '@' + extras.referredBy.username}</button> : <b>—</b>}</div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">People referred</span><b>{extras ? extras.referrals.length : '…'}</b></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Total referral earnings</span><b>{extras ? usdt(extras.referralEarningsBdt) : '…'}</b></div>
                </div>
                {extras?.referrals.map((r: any) => (
                  <button key={r.id} onClick={() => navigate('/admin/users/' + r.id)} className="w-full flex items-center gap-3 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-violet-300 transition">
                    <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{r.name || '@' + r.username}</span><span className="block text-xs text-slate-400 mt-0.5">@{r.username} · joined {fmtDateTime(r.createdAt)}</span></span>
                  </button>
                ))}
              </div>
            )}
            {section === 'activity' && (
              <div className="space-y-2">
                {!extras ? <p className="text-sm text-slate-400">Loading activity…</p> : extras.audit.length === 0 ? <p className="text-sm text-slate-400">No recorded activity for this user yet.</p> : extras.audit.map((a: any) => (
                  <div key={a.id} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-sm">
                    <div className="flex items-center gap-2"><b className="flex-1 min-w-0 truncate">{a.action}</b><span className="text-xs text-slate-400 shrink-0">{fmtDateTime(a.createdAt)}</span></div>
                    {a.detail ? <p className="text-xs text-slate-400 mt-1 break-words">{a.detail}</p> : null}
                  </div>
                ))}
              </div>
            )}
            {section === 'control' && (
              <div className="rounded-3xl border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/5 p-5">
                <p className="font-extrabold text-red-600 flex items-center gap-2"><Trash2 size={17} /> Delete this user</p>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">This permanently deletes the account everywhere: the login (Firebase Auth), profile, wallet and balances, all transactions, deposits and withdrawals, loans and stakes, KYC documents, support chats, referrals, sessions and logs. <b>This cannot be undone.</b></p>
                {u.role === 'admin' ? <p className="text-sm font-bold text-red-600 mt-3">Admin accounts cannot be deleted.</p>
                : u.id === user.id ? <p className="text-sm font-bold text-red-600 mt-3">You cannot delete your own account.</p>
                : myScope !== 'full' ? <p className="text-sm font-bold text-red-600 mt-3">Only the full admin can delete users.</p>
                : (<>
                  <p className="text-sm font-bold mt-4">Type the username <span className="font-mono">{u.username}</span> to confirm:</p>
                  <input value={delText} onChange={e => setDelText(e.target.value)} placeholder={u.username} className="mt-2 w-full rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-bold outline-none focus:ring-2 ring-red-400" />
                  <Btn variant="danger" className="w-full mt-3" disabled={delBusy || delText.trim() !== u.username} onClick={async () => { setDelBusy(true); try { await apiPost('/v1/admin/delete-user', { userId: suidOf(u) }); toast({ kind: 'success', title: 'User deleted', body: u.name + ' (' + u.username + ') and all their data were removed.' }); navigate('/admin?tab=users') } catch (e: any) { toast({ kind: 'error', title: e.message || 'Delete failed' }); setDelBusy(false) } }}>{delBusy ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={15} /> Delete user permanently</>}</Btn>
                </>)}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
