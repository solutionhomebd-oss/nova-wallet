import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, Info, KeyRound, Loader2, Mail, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store'
import { apiGet, apiPost } from '../lib/api'
import { Avatar, Badge, Btn, Card, Empty, Input, MsgTicks } from '../components/ui'
import { fmtDateTime } from '../lib/utils'
import type { SupportTicket } from '../lib/types'

// Fixed support subjects — users pick from this list only (no typing);
// "Others" stays last, as the owner asked.
export const SUPPORT_SUBJECTS = [
  'Account & Login', 'KYC & Verification', 'Deposit / Add Money', 'Withdrawal / Cash Out',
  'Send Money / Transfer', 'Crypto Buy, Sell & Swap', 'Loan', 'Earn, Staking & Rewards',
  'Referral', 'Level Upgrade', 'Transaction Problem', 'Fees & Limits', 'Security Concern',
  'App Problem / Bug', 'Feedback & Suggestion', 'Others',
]

const statusBadge = (st: string) => st === 'pending' ? <Badge tone="amber">Pending</Badge> : st === 'processing' ? <Badge tone="violet">Processing</Badge> : <Badge tone="green">Resolved</Badge>

// One message list for both chat pages. System messages (verification
// prompts and results) sit centred at ~75% opacity, as the owner asked;
// regular bubbles keep the WhatsApp-style layout with read ticks.
function ChatMessages({ tk, selfFrom, otherName }: { tk: SupportTicket; selfFrom: 'user' | 'admin'; otherName: string }) {
  const { t } = useApp()
  return (
    <>
      {tk.messages.map(m => {
        if (m.from === 'system' && m.text.startsWith('PINSECURE::')) {
          const pinVal = m.text.slice('PINSECURE::'.length)
          return (
            <div key={m.id} className="flex justify-center px-2">
              <div className="text-center px-5 py-3.5 rounded-3xl bg-slate-300/75 dark:bg-slate-600/75 text-slate-700 dark:text-slate-100 max-w-[86%]">
                <p className="text-[11px] font-extrabold uppercase tracking-wide opacity-80">{selfFrom === 'user' ? '🔐 Your transaction PIN' : '🔐 Transaction PIN sent to the user'}</p>
                <p className="text-2xl font-extrabold tracking-[0.35em] mt-1">{selfFrom === 'user' ? pinVal : '****'}</p>
                <p className="text-[11px] font-semibold leading-relaxed mt-1.5 opacity-90">{selfFrom === 'user' ? 'আপনার পিন এনক্রাইপটেড। এটা আপনি ছাড়া অন্য কেউ দেখতে পারবে না।' : 'Hidden for privacy — only the user can see their PIN.'}</p>
              </div>
            </div>
          )
        }
        if (m.from === 'system') return (
          <div key={m.id} className="flex justify-center px-2">
            <p className="text-center text-xs font-semibold leading-relaxed px-4 py-2 rounded-2xl bg-slate-300/75 dark:bg-slate-600/75 text-slate-700 dark:text-slate-100 max-w-[86%]">{m.text}</p>
          </div>
        )
        const mine = m.from === selfFrom
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm ${mine ? 'bg-violet-600 text-white rounded-br-md' : 'bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-bl-md'}`}>
              {!mine && <p className="text-[10px] font-extrabold text-violet-500 mb-0.5">{m.from === 'admin' ? t('chat_team') : otherName}</p>}
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <p className={`text-[10px] mt-1 ${mine ? 'text-violet-200' : 'text-slate-400'}`}>
                {fmtDateTime(m.at)}
                {mine && (m.pending
                  ? <span className="ml-1.5 font-bold">Sending…</span>
                  : <MsgTicks at={m.at} readAt={selfFrom === 'user' ? tk.adminReadAt : tk.userReadAt} fetchedAt={selfFrom === 'user' ? tk.adminFetchedAt : tk.userFetchedAt} label />)}
                {!mine && m.from === 'user' && <MsgTicks at={m.at} readAt={tk.adminReadAt} fetchedAt={tk.adminFetchedAt} tone="dark" label />}
              </p>
            </div>
          </div>
        )
      })}
    </>
  )
}

// Shared send behaviour: optimistic bubble from the store, an 800ms
// minimum spinner, and the spinner clears as soon as the store confirms.
function useChatSend(tk: SupportTicket | undefined, as: 'user' | 'admin') {
  const { replyTicket } = useApp()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const startRef = useRef(0)
  useEffect(() => {
    if (!sending || !tk) return
    if (tk.messages.some(m => m.from === as && m.pending)) return
    const id = window.setTimeout(() => setSending(false), Math.max(0, 800 - (Date.now() - startRef.current)))
    return () => window.clearTimeout(id)
  }, [sending, tk, as])
  const send = () => {
    if (!tk || !text.trim() || sending) return
    const t0 = Date.now(); startRef.current = t0; setSending(true)
    void replyTicket(tk.id, text, as).finally(() => window.setTimeout(() => setSending(false), Math.max(0, 800 - (Date.now() - t0))))
    setText('')
  }
  return { text, setText, sending, send }
}

function useScrollToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [dep])
  return ref
}

/* ---------------- User: ticket list + new chat ---------------- */

export function SupportListPage() {
  const { db, user, addTicket, toast, t } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ subject: '', message: '' })
  const [starting, setStarting] = useState(false)
  if (!user) return null
  const mine = db.tickets.filter(x => x.userId === user.id).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const start = async () => {
    if (starting) return
    if (!form.subject) return toast({ kind: 'error', title: 'Select a subject' })
    if (!form.message.trim()) return toast({ kind: 'error', title: 'Write your message' })
    setStarting(true)
    const err = await addTicket(form.subject.trim(), form.message.trim())
    setStarting(false)
    if (err) return toast({ kind: 'error', title: err })
    setForm({ subject: '', message: '' })
    toast({ kind: 'success', title: 'Support chat started', body: 'Status: Pending — we usually reply within 1 hour.' })
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"><ArrowLeft size={17} /></button>
        <div>
          <h1 className="font-extrabold text-lg leading-tight">{t('p_support')}</h1>
          <p className="text-xs text-slate-500">Chat with our support team — we usually reply within 1 hour.</p>
        </div>
      </div>
      <Card className="p-5 mb-5">
        <p className="font-extrabold text-sm mb-3">{t('chat_new')}</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">Subject</label>
            <select value={form.subject} onChange={e => setForm(x => ({ ...x, subject: e.target.value }))} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400">
              <option value="" disabled>Select a subject</option>
              {SUPPORT_SUBJECTS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <Input label="Message" value={form.message} onChange={e => setForm(x => ({ ...x, message: e.target.value }))} />
          <Btn className="w-full py-3.5" disabled={starting} onClick={start}>{starting ? <Loader2 size={16} className="animate-spin" /> : t('chat_start')}</Btn>
        </div>
      </Card>
      {mine.length > 0 && (
        <>
          <p className="font-extrabold text-sm mb-2.5">{t('chat_history')}</p>
          <div className="space-y-2">
            {mine.map(x => (
              <button key={x.id} onClick={() => navigate('/support/' + x.id)} className="w-full text-left">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-sm truncate">{x.subject}</span>
                      <span className="text-xs text-slate-400">{fmtDateTime(x.updatedAt)}{x.messages.length > 0 ? ' · ' + x.messages[x.messages.length - 1].text.slice(0, 60) : ''}</span>
                    </span>
                    {x.messages[x.messages.length - 1]?.from === 'admin' && (x.userReadAt ?? '') < x.updatedAt && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />}
                    {statusBadge(x.status)}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- User: full-page chat ---------------- */

export function SupportChatPage() {
  const { db, user, markTicketRead, replyTicket, t } = useApp()
  const navigate = useNavigate()
  const { ticketId } = useParams()
  const tk = user ? db.tickets.find(x => x.id === ticketId && x.userId === user.id) : undefined
  const { text, setText, sending, send } = useChatSend(tk, 'user')
  const scrollRef = useScrollToBottom(tk?.messages.length)
  useEffect(() => { if (ticketId) void markTicketRead(ticketId, false) }, [ticketId])
  if (!user) return null
  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 190px)', minHeight: 340 }}>
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button onClick={() => navigate('/support')} className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"><ArrowLeft size={17} /></button>
        <p className="font-extrabold text-sm flex-1 truncate">{tk?.subject ?? 'Support chat'}</p>
        {tk?.verifyStatus === 'verified' && <Badge tone="green">✅ Verified</Badge>}
        {tk && statusBadge(tk.status)}
      </div>
      {!tk ? (
        <Card className="p-6"><Empty title="Chat not available" body="This conversation may have been deleted, or it belongs to another account." /></Card>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2.5 mb-3">
            <ChatMessages tk={tk} selfFrom="user" otherName="Support" />
          </div>
          {tk.status === 'resolved' ? (
            <div className="shrink-0">
              {tk.ratingAsked && !tk.rating ? (
                <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-500/10 rounded-2xl px-3.5 py-3 mb-2">
                  <p className="flex-1 text-xs font-bold">How was your support experience?</p>
                  <button onClick={() => void replyTicket(tk.id, '👍', 'user')} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg">👍</button>
                  <button onClick={() => void replyTicket(tk.id, '👎', 'user')} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg">👎</button>
                </div>
              ) : null}
              <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-3">{t('chat_closed_note')}</p>
            </div>
          ) : (
            <div className="flex gap-2 shrink-0">
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder={t('chat_placeholder')} className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400" />
              <Btn className="!px-5 shrink-0" disabled={sending} onClick={send}>{sending ? <Loader2 size={16} className="animate-spin" /> : t('chat_send')}</Btn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ---------------- Admin: full-page chat ---------------- */

export function AdminSupportChatPage() {
  const { db, user, markTicketRead, resolveTicket, deleteTicket, startChatVerify, setChatVerify, sendChatPin, toast, walletOf, fmtMoney } = useApp()
  const navigate = useNavigate()
  const { ticketId } = useParams()
  const tk = db.tickets.find(x => x.id === ticketId)
  const tku = tk ? db.users.find(u => u.id === tk.userId) : undefined
  const { text, setText, sending, send } = useChatSend(tk, 'admin')
  const scrollRef = useScrollToBottom(tk?.messages.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [menuDelArm, setMenuDelArm] = useState(false)
  const [menuBusy, setMenuBusy] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [canned, setCanned] = useState<{ id: string; title: string; text: string }[] | null>(null)
  const [tplForm, setTplForm] = useState<{ id?: string; title: string; text: string } | null>(null)
  const [tplBusy, setTplBusy] = useState(false)
  useEffect(() => { if (ticketId) void markTicketRead(ticketId, true) }, [ticketId])
  useEffect(() => { setMenuOpen(false); setMenuDelArm(false); setInfoOpen(false) }, [ticketId])
  useEffect(() => {
    if (!menuDelArm) return
    const id = window.setTimeout(() => setMenuDelArm(false), 4000)
    return () => window.clearTimeout(id)
  }, [menuDelArm])
  // Quick replies are prefetched on mount from the light endpoint, so the
  // panel opens instantly (the full admin overview is far too heavy).
  useEffect(() => {
    if (canned !== null) return
    let alive = true
    const tryFetch = (n: number) => {
      apiGet('/v1/admin/canned').then((r: any) => { if (alive) setCanned(r.cannedReplies ?? []) }).catch(() => { if (alive && n < 6) window.setTimeout(() => tryFetch(n + 1), 1500) })
    }
    tryFetch(0)
    return () => { alive = false }
  }, [canned, tplOpen])
  const saveCanned = async () => {
    if (!tplForm || tplBusy) return
    if (!tplForm.title.trim() || !tplForm.text.trim()) return toast({ kind: 'error', title: 'Write a title and the reply text' })
    setTplBusy(true)
    try { const r: any = await apiPost('/v1/admin/canned/save', { item: tplForm }); const ov = r.overview ?? r; setCanned(ov.cannedReplies ?? []); setTplForm(null); toast({ kind: 'success', title: 'Template saved' }) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
    setTplBusy(false)
  }
  const delCanned = async (id: string) => {
    try { const r: any = await apiPost('/v1/admin/canned/delete', { id }); const ov = r.overview ?? r; setCanned(ov.cannedReplies ?? []) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  if (!user || user.role !== 'admin') return <Card className="p-6"><Empty title="Admins only" body="This page is part of the admin panel." /></Card>
  const runMenu = async (key: string, fn: () => Promise<string | null>, okTitle: string, okBody?: string) => {
    if (menuBusy) return
    setMenuBusy(key)
    const err = await fn()
    setMenuBusy('')
    setMenuOpen(false)
    if (err) return toast({ kind: 'error', title: err })
    toast({ kind: 'success', title: okTitle, body: okBody })
  }
  const menuItem = "w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 190px)', minHeight: 340 }}>
      <div className="flex items-center gap-2.5 flex-wrap mb-3 shrink-0">
        <button onClick={() => navigate('/admin?tab=support')} className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"><ArrowLeft size={17} /></button>
        <Avatar name={tku?.name ?? '?'} photo={tku?.photo} />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold truncate">{tk?.subject ?? 'Support chat'}</p>
          <p className="text-xs text-slate-400 truncate">{tku?.name} · @{tku?.username} · {tku?.email}</p>
        </div>
        {tk && (
          <div className="relative shrink-0">
            <button onClick={() => { setMenuOpen(o => !o); setMenuDelArm(false) }} title="Chat menu" className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center"><MoreVertical size={18} /></button>
            {menuOpen && (
              <>
                <button aria-hidden className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-40 w-64 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 overflow-hidden anim-fade-up max-h-[75vh] overflow-y-auto">
                  <button className={menuItem} onClick={() => setInfoOpen(o => !o)}>
                    <Info size={17} className="text-sky-500" />
                    <span className="flex-1">Info<span className="block text-[11px] font-semibold text-slate-400">Customer & chat details</span></span>
                  </button>
                  {infoOpen && tku && (
                    <div className="mx-3 mb-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 space-y-1.5">
                      {[
                        ['Status', tk.status],
                        ['Route', tk.route ?? 'general'],
                        ['Verified', tk.verifyStatus === 'verified' ? 'Yes' : 'No'],
                        ['Level', String(tku.level)],
                        ['KYC', tku.kyc],
                        ['Balance', fmtMoney(walletOf(tku.id)?.available ?? 0)],
                        ['Open chats', String(db.tickets.filter(x => x.userId === tku.id && x.status !== 'resolved').length)],
                        ...(tk.rating ? [['Rating', tk.rating === 'good' ? '👍 Good' : '👎 Bad']] : []),
                      ].map(([k, v]) => (
                        <p key={k} className="flex justify-between gap-3 text-xs"><span className="font-semibold text-slate-400">{k}</span><span className="font-bold capitalize text-right">{v}</span></p>
                      ))}
                    </div>
                  )}
                  <button className={menuItem} disabled={!!menuBusy} onClick={() => runMenu('verify', () => setChatVerify(tk.id, tk.verifyStatus !== 'verified'), tk.verifyStatus === 'verified' ? 'Marked as Unverified' : 'Marked as Verified')}>
                    <ShieldCheck size={17} className={tk.verifyStatus === 'verified' ? 'text-emerald-500' : 'text-slate-400'} />
                    <span className="flex-1">{tk.verifyStatus === 'verified' ? 'Verified' : 'Unverified'}<span className="block text-[11px] font-semibold text-slate-400">{tk.verifyStatus === 'verified' ? 'Tap to mark unverified' : 'Tap to mark verified manually'}</span></span>
                    {menuBusy === 'verify' && <Loader2 size={15} className="animate-spin" />}
                  </button>
                  {tk.status !== 'resolved' && (
                    <button className={menuItem} disabled={!!menuBusy} onClick={() => runMenu('code', () => startChatVerify(tk.id), 'Verification code sent', 'The code was emailed to ' + (tku?.email ?? 'the user') + '. Ask them to send it here in the chat.')}>
                      <Mail size={17} className="text-violet-500" />
                      <span className="flex-1">{tk.verifyStatus === 'pending' ? 'Resend Code' : 'Send Code'}<span className="block text-[11px] font-semibold text-slate-400">Email a 6-digit verification code</span></span>
                      {menuBusy === 'code' && <Loader2 size={15} className="animate-spin" />}
                    </button>
                  )}
                  {tk.status !== 'resolved' && (
                    <button className={menuItem} disabled={!!menuBusy} onClick={() => runMenu('pin', () => sendChatPin(tk.id), 'PIN sent to the user', 'Only the user can see it — it stays **** here.')}>
                      <KeyRound size={17} className="text-amber-500" />
                      <span className="flex-1">Send PIN<span className="block text-[11px] font-semibold text-slate-400">Send the current PIN — visible only to the user</span></span>
                      {menuBusy === 'pin' && <Loader2 size={15} className="animate-spin" />}
                    </button>
                  )}
                  {tk.status !== 'resolved' && (
                    <button className={menuItem} onClick={() => { resolveTicket(tk.id); setMenuOpen(false); toast({ kind: 'success', title: 'Chat resolved & closed' }) }}>
                      <Check size={17} className="text-emerald-500" />
                      <span className="flex-1">Resolved<span className="block text-[11px] font-semibold text-slate-400">Mark resolved and close this chat</span></span>
                    </button>
                  )}
                  <button className={menuItem} onClick={() => {
                    if (!menuDelArm) { setMenuDelArm(true); return }
                    deleteTicket(tk.id); setMenuOpen(false); toast({ kind: 'success', title: 'Chat deleted', body: 'The whole conversation was removed.' }); navigate('/admin?tab=support')
                  }}>
                    <Trash2 size={17} className="text-rose-500" />
                    <span className="flex-1 text-rose-600">{menuDelArm ? 'Tap again to delete' : 'Delete'}<span className="block text-[11px] font-semibold text-slate-400">Delete this whole conversation</span></span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {!tk ? (
        <Card className="p-6"><Empty title="Chat not available" body="This conversation may have been deleted." /></Card>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2.5 mb-3">
            <ChatMessages tk={tk} selfFrom="admin" otherName={tku?.name ?? 'User'} />
          </div>
          {tk.status === 'resolved' ? (
            <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-3 shrink-0">This chat is resolved and closed. The customer must open a new chat for further help.</p>
          ) : (
            <div className="shrink-0">
              <div className="flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Type your reply…" className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400" />
                <button onClick={() => setTplOpen(o => !o)} title="Quick replies" className={`shrink-0 w-11 rounded-2xl border flex items-center justify-center ${tplOpen ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}><BookOpen size={17} /></button>
                <Btn className="!px-5 shrink-0" disabled={sending} onClick={send}>{sending ? <Loader2 size={16} className="animate-spin" /> : 'Send'}</Btn>
              </div>
              {tplOpen && (
                <div className="mt-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-extrabold text-sm">Quick replies</p>
                    <button onClick={() => setTplForm({ title: '', text: '' })} className="text-xs font-bold text-violet-600">+ New template</button>
                  </div>
                  {canned === null ? <p className="text-xs text-slate-400 flex items-center gap-2 py-2"><Loader2 size={13} className="animate-spin" /> Loading…</p>
                    : canned.length === 0 ? <p className="text-xs text-slate-400 py-2">No templates yet — create your first one.</p>
                    : canned.map(c => (
                      <div key={c.id} className="flex items-start gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <button className="flex-1 min-w-0 text-left" onClick={() => setText(c.text)}>
                          <span className="block font-bold text-xs">{c.title}</span>
                          <span className="block text-xs text-slate-400 truncate">{c.text}</span>
                        </button>
                        <button onClick={() => setTplForm({ id: c.id, title: c.title, text: c.text })} className="text-[11px] font-bold text-slate-400 shrink-0">Edit</button>
                        <button onClick={() => void delCanned(c.id)} className="text-[11px] font-bold text-rose-500 shrink-0">Delete</button>
                      </div>
                    ))}
                  {tplForm && (
                    <div className="mt-3 space-y-2">
                      <input value={tplForm.title} onChange={e => setTplForm(f => f && ({ ...f, title: e.target.value }))} placeholder="Template title" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-violet-400" />
                      <textarea value={tplForm.text} onChange={e => setTplForm(f => f && ({ ...f, text: e.target.value }))} placeholder="Reply text" rows={3} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-violet-400" />
                      <div className="flex items-center gap-3">
                        <Btn className="!py-2 !px-4" disabled={tplBusy} onClick={saveCanned}>{tplBusy ? <Loader2 size={14} className="animate-spin" /> : 'Save template'}</Btn>
                        <button onClick={() => setTplForm(null)} className="text-xs font-bold text-slate-400">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
