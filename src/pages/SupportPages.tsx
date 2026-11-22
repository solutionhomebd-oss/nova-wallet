import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, Loader2, Send, ShieldCheck, Trash2, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Empty, Input, MsgTicks } from '../components/ui'
import { fmtDateTime } from '../lib/utils'
import type { SupportTicket } from '../lib/types'

const statusBadge = (st: string) => st === 'pending' ? <Badge tone="amber">Pending</Badge> : st === 'processing' ? <Badge tone="violet">Processing</Badge> : <Badge tone="green">Resolved</Badge>

// One message list for both chat pages. System messages (verification
// prompts and results) sit centred at ~75% opacity, as the owner asked;
// regular bubbles keep the WhatsApp-style layout with read ticks.
function ChatMessages({ tk, selfFrom, otherName }: { tk: SupportTicket; selfFrom: 'user' | 'admin'; otherName: string }) {
  const { t } = useApp()
  return (
    <>
      {tk.messages.map(m => {
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
    if (!form.subject.trim() || !form.message.trim()) return toast({ kind: 'error', title: 'Write a subject and your message' })
    setStarting(true)
    const err = await addTicket(form.subject.trim(), form.message.trim())
    setStarting(false)
    if (err) return toast({ kind: 'error', title: err })
    setForm({ subject: '', message: '' })
    toast({ kind: 'success', title: 'Support chat started', body: 'Status: Pending — we usually reply within 24 hours.' })
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"><ArrowLeft size={17} /></button>
        <div>
          <h1 className="font-extrabold text-lg leading-tight">{t('p_support')}</h1>
          <p className="text-xs text-slate-500">Chat with our support team — we usually reply within 24 hours.</p>
        </div>
      </div>
      <Card className="p-5 mb-5">
        <p className="font-extrabold text-sm mb-3">{t('chat_new')}</p>
        <div className="space-y-4">
          <Input label="Subject" value={form.subject} onChange={e => setForm(x => ({ ...x, subject: e.target.value }))} />
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
  const { db, user, markTicketRead, t } = useApp()
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
        <Card className="p-6"><Empty title="Chat not available" body="This conversation may have been closed or deleted." /></Card>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2.5 mb-3">
            <ChatMessages tk={tk} selfFrom="user" otherName={t('chat_team')} />
          </div>
          {tk.status === 'resolved' ? (
            <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-3 shrink-0">{t('chat_closed_note')}</p>
          ) : (
            <div className="flex gap-2 shrink-0">
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder={t('chat_placeholder')} className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400" />
              <Btn className="!px-4 shrink-0" disabled={sending} onClick={send}>{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</Btn>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ---------------- Admin: full-page chat with options panel ---------------- */

export function AdminSupportChatPage() {
  const { db, user, markTicketRead, resolveTicket, deleteTicket, startChatVerify, toast } = useApp()
  const navigate = useNavigate()
  const { ticketId } = useParams()
  const tk = db.tickets.find(x => x.id === ticketId)
  const tku = tk ? db.users.find(u => u.id === tk.userId) : undefined
  const { text, setText, sending, send } = useChatSend(tk, 'admin')
  const scrollRef = useScrollToBottom(tk?.messages.length)
  const [delArm, setDelArm] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [verifyBusy, setVerifyBusy] = useState(false)
  useEffect(() => { if (ticketId) void markTicketRead(ticketId, true) }, [ticketId])
  useEffect(() => { setDelArm(false) }, [ticketId])
  useEffect(() => {
    if (!delArm) return
    const id = window.setTimeout(() => setDelArm(false), 4000)
    return () => window.clearTimeout(id)
  }, [delArm])
  if (!user || user.role !== 'admin') return <Card className="p-6"><Empty title="Admins only" body="This page is part of the admin panel." /></Card>
  const startVerify = async () => {
    if (!tk || verifyBusy) return
    setVerifyBusy(true)
    const err = await startChatVerify(tk.id)
    setVerifyBusy(false)
    if (err) return toast({ kind: 'error', title: err })
    toast({ kind: 'success', title: 'Verification code sent', body: 'The code was emailed to ' + (tku?.email ?? 'the user') + '. Ask them to send it here in the chat.' })
  }
  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 190px)', minHeight: 340 }}>
      <div className="flex items-center gap-2.5 flex-wrap mb-3 shrink-0">
        <button onClick={() => navigate('/admin?tab=support')} className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0"><ArrowLeft size={17} /></button>
        <Avatar name={tku?.name ?? '?'} photo={tku?.photo} />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold truncate">{tk?.subject ?? 'Support chat'}</p>
          <p className="text-xs text-slate-400 truncate">{tku?.name} · @{tku?.username} · {tku?.email}</p>
        </div>
        {tk?.verifyStatus === 'verified' && <Badge tone="green">✅ Verified</Badge>}
        {tk && statusBadge(tk.status)}
        {tk && tk.status !== 'resolved' && <button onClick={() => { resolveTicket(tk.id); toast({ kind: 'success', title: 'Chat resolved & closed' }) }} title="Mark resolved" className="inline-flex items-center justify-center shrink-0 rounded-full px-3.5 py-2.5 text-white bg-emerald-500 hover:bg-emerald-400 active:scale-[.98] transition"><Check size={16} strokeWidth={3} /></button>}
        {tk && (delArm ? (
          <button onClick={() => { deleteTicket(tk.id); toast({ kind: 'success', title: 'Chat deleted', body: 'The whole conversation was removed.' }); navigate('/admin?tab=support') }} title="Tap again to delete this chat" className="inline-flex items-center justify-center shrink-0 rounded-full px-3.5 py-2.5 text-white bg-rose-600 hover:bg-rose-500 active:scale-[.98] transition"><Check size={16} strokeWidth={3} /></button>
        ) : (
          <button onClick={() => setDelArm(true)} title="Delete this chat" className="inline-flex items-center justify-center shrink-0 rounded-full px-3.5 py-2.5 text-rose-500 border border-rose-300/60 dark:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-[.98] transition"><Trash2 size={15} /></button>
        ))}
      </div>
      {!tk ? (
        <Card className="p-6"><Empty title="Chat not available" body="This conversation may have been deleted." /></Card>
      ) : (
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2.5 mb-3">
            <ChatMessages tk={tk} selfFrom="admin" otherName={tku?.name ?? 'User'} />
          </div>
          {/* Side arrow: opens the chat options panel (more options will live here) */}
          <button onClick={() => setPanelOpen(o => !o)} title="Chat options" className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-14 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-violet-600 transition">
            <ChevronRight size={19} className={`transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
          </button>
          {panelOpen && (
            <div className="absolute right-14 top-1/2 -translate-y-1/2 z-20 w-64 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 p-4 anim-fade-up">
              <div className="flex items-center justify-between mb-3">
                <p className="font-extrabold text-sm">Chat options</p>
                <button onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5">
                <p className="font-bold text-sm flex items-center gap-1.5"><ShieldCheck size={15} className="text-violet-500" /> Identity verification</p>
                <p className="text-xs text-slate-500 mt-1">
                  {tk.verifyStatus === 'verified' ? '✅ This user is verified for this chat.'
                    : tk.verifyStatus === 'pending' ? '⏳ Code sent — waiting for the user to send it here.'
                    : 'Email the user a 6-digit code and ask them to send it here in the chat.'}
                </p>
                {tk.status !== 'resolved' && tk.verifyStatus !== 'verified' && (
                  <Btn className="w-full mt-3 !py-2.5" disabled={verifyBusy} onClick={startVerify}>
                    {verifyBusy ? <Loader2 size={15} className="animate-spin" /> : tk.verifyStatus === 'pending' ? 'Resend code' : 'Verify user'}
                  </Btn>
                )}
              </div>
            </div>
          )}
          {tk.status === 'resolved' ? (
            <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-3 shrink-0">This chat is resolved and closed. The customer must open a new chat for further help.</p>
          ) : (
            <div className="flex gap-2 shrink-0">
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Type your reply…" className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400" />
              <Btn className="!px-5 shrink-0" disabled={sending} onClick={send}>{sending ? <Loader2 size={16} className="animate-spin" /> : 'Send'}</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
