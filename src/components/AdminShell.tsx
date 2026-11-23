import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowLeft, ArrowLeftRight, Award, BarChart3, Bell, CheckCheck, ChevronDown, CreditCard, Gift, HandCoins, LayoutDashboard, Mail, Megaphone, Menu, MessageCircle, Newspaper, ScrollText, Search, Send, Server, Settings as SettingsIcon, ShieldCheck, ToggleLeft, Users, Wallet, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Empty, Modal } from './ui'
import { fmtDateTime } from '../lib/utils'

export const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'finance', label: 'Deposits & Withdrawals', icon: Wallet },
  { id: 'txs', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'kyc', label: 'KYC Verification', icon: ShieldCheck },
  { id: 'loans', label: 'Loans', icon: HandCoins },
  { id: 'referrals', label: 'Referrals', icon: Gift },
  { id: 'levels', label: 'Levels', icon: Award },
  { id: 'support', label: 'Support Chat', icon: MessageCircle },
  { id: 'broadcast', label: 'Broadcast', icon: Send },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'banners', label: 'Banners', icon: Megaphone },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'emaillog', label: 'Email Log', icon: Mail },
  { id: 'payments', label: 'Payment Methods', icon: CreditCard },
  { id: 'settings', label: 'Platform Settings', icon: SettingsIcon },
  { id: 'features', label: 'Feature Switches', icon: ToggleLeft },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
] as const

/** Sidebar grouping (owner's reorganization, 2026-11-23): related tabs live
 * under one expandable group header; the rest stay single rows. MENU_ORDER
 * interleaves singles and groups ('g-' prefix = group). Tab ids themselves
 * are unchanged, so scopes, badges and deep links keep working. */
export const MENU_GROUPS = [
  { id: 'g-finance', label: 'Finance', icon: Wallet, children: ['finance', 'txs'] },
  { id: 'g-users', label: 'Users', icon: Users, children: ['users', 'kyc', 'levels'] },
  { id: 'g-content', label: 'Content', icon: Newspaper, children: ['broadcast', 'news', 'banners'] },
  { id: 'g-settings', label: 'Settings', icon: SettingsIcon, children: ['settings', 'features', 'payments', 'danger'] },
  { id: 'g-system', label: 'System', icon: Server, children: ['audit', 'reports', 'health', 'emaillog'] },
] as const
export const MENU_ORDER = ['overview', 'g-finance', 'g-users', 'loans', 'referrals', 'support', 'g-content', 'g-settings', 'g-system'] as const

type MenuTab = { id: string; label: string; icon: any }

/** The grouped sidebar menu, shared by the Admin panel page and the
 * standalone AdminShell pages so the two never drift apart. A group opens
 * automatically when it contains the active tab; its header shows the
 * summed pending badge while collapsed. */
export function AdminMenuNav({ tabs, badges, active, onGo }: { tabs: readonly MenuTab[]; badges: Record<string, number>; active: string; onGo: (id: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const byId = new Map(tabs.map(t => [t.id, t]))
  const badgeCls = "min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center justify-center"
  const rowCls = (isActive: boolean) => `flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${isActive ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`
  const childCls = (isActive: boolean) => `w-full flex items-center gap-3 pl-11 pr-3.5 py-2.5 mt-0.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${isActive ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`
  return (
    <>
      {MENU_ORDER.map(key => {
        if (!key.startsWith('g-')) {
          const t = byId.get(key)
          if (!t) return null
          return (
            <div key={key} className="flex items-center gap-1">
              <button onClick={() => onGo(t.id)} className={rowCls(active === t.id)}>
                <t.icon size={18} className="shrink-0" /> <span className="flex-1 text-left">{t.label}</span>
                {(badges[t.id] ?? 0) > 0 && <span className={badgeCls}>{badges[t.id]}</span>}
              </button>
            </div>
          )
        }
        const g = MENU_GROUPS.find(x => x.id === key)
        if (!g) return null
        const kids = g.children.map(id => byId.get(id)).filter((t): t is MenuTab => !!t)
        if (kids.length === 0) return null
        const containsActive = kids.some(t => t.id === active)
        const isOpen = open[g.id] ?? containsActive
        const groupBadge = kids.reduce((s, t) => s + (badges[t.id] ?? 0), 0)
        return (
          <div key={g.id}>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))} className={`flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${containsActive || isOpen ? 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}>
                <g.icon size={18} className="shrink-0" /> <span className="flex-1 text-left">{g.label}</span>
                {!isOpen && groupBadge > 0 && <span className={badgeCls}>{groupBadge}</span>}
              </button>
              <button aria-label={`Toggle ${g.label} submenu`} onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))} className={`p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform ${isOpen ? 'rotate-180' : ''}`}><ChevronDown size={16} /></button>
            </div>
            {isOpen && kids.map(t => (
              <button key={t.id} onClick={() => onGo(t.id)} className={childCls(active === t.id)}>
                <t.icon size={17} className="shrink-0" /> <span className="flex-1 text-left">{t.label}</span>
                {(badges[t.id] ?? 0) > 0 && <span className={badgeCls}>{badges[t.id]}</span>}
              </button>
            ))}
          </div>
        )
      })}
    </>
  )
}

/** Which tabs each admin scope may see. 'full' (the owner) sees all.
 * The Worker enforces the same boundaries on the API itself. */
export const SCOPE_TABS: Record<string, string[]> = {
  finance: ['overview', 'finance', 'txs', 'users', 'loans', 'referrals', 'levels', 'reports', 'audit'],
  content: ['overview', 'users', 'support', 'broadcast', 'news', 'banners', 'audit'],
  support: ['overview', 'users', 'kyc', 'support'],
}

/** The admin panel's own chrome — top bar + sidebar/drawer — for standalone
 * admin pages (e.g. the full-page support chat) that live OUTSIDE the /admin
 * tab page. Without this shell those pages fell back to the customer Layout
 * (customer header + bottom nav), which the owner flagged on 2026-11-23.
 * Menu items deep-link into the panel: /admin?tab=<id>. */
export default function AdminShell() {
  const { user, db, markRead, markAllRead } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  if (!user) return null
  // The standalone page this shell wraps decides which tab reads as active.
  const tab: string = pathname.startsWith('/admin/support') ? 'support' : pathname.startsWith('/admin/users') ? 'users' : ''
  const myScope = user.adminScope ?? 'full'
  const visibleTabs = TABS.filter(t => myScope === 'full' || (SCOPE_TABS[myScope] ?? []).includes(t.id))
  const tabBadges: Record<string, number> = {
    finance: db.deposits.filter(d => d.status === 'pending').length + db.withdrawals.filter(d => d.status === 'pending').length,
    kyc: db.users.filter(u => u.kyc === 'pending').length,
    loans: db.loans.filter(l => l.status === 'pending').length,
    levels: db.levelRequests.filter(r => r.status === 'pending').length,
    support: db.tickets.filter(t => t.status === 'pending').length,
  }
  const byDateDesc = <T extends { createdAt: string }>(arr: T[]): T[] => [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const myNotifs = byDateDesc(db.notifications.filter(n => n.userId === user.id))
  const myUnread = myNotifs.filter(n => !n.read).length
  const goTab = (id: string) => { setMenuOpen(false); navigate('/admin?tab=' + id) }
  const openNotif = (n: typeof myNotifs[number]) => {
    markRead(n.id); setNotifOpen(false)
    // The /admin page parses tab=/user=/tx=/kycfocus= deep links on mount,
    // so a notification's own link can simply be navigated to.
    if (n.link && n.link.startsWith('/admin')) { navigate(n.link); return }
    const kindTab: Record<string, string> = { support: 'support', deposit: 'finance', withdraw: 'finance', loan: 'loans', kyc: 'kyc', upgrade: 'levels' }
    navigate('/admin?tab=' + (kindTab[n.kind] ?? 'overview'))
  }
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 lg:hidden"><Menu size={18} /></button>
          <h1 className="font-extrabold text-lg flex items-center gap-2"><ShieldCheck className="text-amber-500" /> Admin Panel</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => navigate('/admin?search=1')} aria-label="Search" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Search size={18} /></button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Bell size={18} />{myUnread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center justify-center">{myUnread}</span>}</button>
            <Link to="/" aria-label="Back to user app" title="Back to user app" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={18} /></Link>
          </div>
        </div>
      </header>

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
            <AdminMenuNav tabs={visibleTabs} badges={tabBadges} active={tab} onGo={goTab} />
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
          <Outlet />
        </main>
      </div>
    </div>
  )
}
