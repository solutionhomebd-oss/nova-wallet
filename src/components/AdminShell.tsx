import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowLeftRight, Award, BarChart3, Bell, CheckCheck, ChevronDown, CreditCard, Gift, HandCoins, LayoutDashboard, Mail, Menu, MessageCircle, Newspaper, ScrollText, Search, Server, Settings as SettingsIcon, ShieldCheck, Users, Wallet, X } from 'lucide-react'
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
  { id: 'content', label: 'News & Banners', icon: Newspaper },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'emaillog', label: 'Email Log', icon: Mail },
  { id: 'payments', label: 'Payment Methods', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

/** Which tabs each admin scope may see. 'full' (the owner) sees all.
 * The Worker enforces the same boundaries on the API itself. */
export const SCOPE_TABS: Record<string, string[]> = {
  finance: ['overview', 'finance', 'txs', 'users', 'loans', 'referrals', 'levels', 'reports', 'audit'],
  content: ['overview', 'users', 'support', 'content', 'audit'],
  support: ['overview', 'users', 'kyc', 'support'],
}

const SYSTEM_IDS = ['audit', 'reports', 'health', 'emaillog']

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
  const [usersOpen, setUsersOpen] = useState(false)
  const [systemOpen, setSystemOpen] = useState(false)
  if (!user) return null
  // The standalone page this shell wraps decides which tab reads as active.
  const tab: string = pathname.startsWith('/admin/support') ? 'support' : pathname.startsWith('/admin/users') ? 'users' : ''
  const myScope = user.adminScope ?? 'full'
  const visibleTabs = TABS.filter(t => myScope === 'full' || (SCOPE_TABS[myScope] ?? []).includes(t.id))
  const systemTabs = visibleTabs.filter(t => SYSTEM_IDS.includes(t.id))
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
  const badgeCls = "min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center justify-center"
  const itemCls = (active: boolean) => `flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${active ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`
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
            {visibleTabs.filter(t => t.id !== 'kyc' && !SYSTEM_IDS.includes(t.id)).map(t => {
              const kycVisible = t.id === 'users' && visibleTabs.some(x => x.id === 'kyc')
              const kycOpen = usersOpen || tab === 'kyc'
              return (
                <div key={t.id}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => goTab(t.id)} className={itemCls(tab === t.id)}>
                      <t.icon size={18} className="shrink-0" /> <span className="flex-1 text-left">{t.label}</span>
                      {(tabBadges[t.id] ?? 0) > 0 && <span className={badgeCls}>{tabBadges[t.id]}</span>}
                      {kycVisible && !kycOpen && (tabBadges.kyc ?? 0) > 0 && <span className={badgeCls}>{tabBadges.kyc}</span>}
                    </button>
                    {kycVisible && (
                      <button aria-label="Toggle KYC Verification submenu" onClick={() => setUsersOpen(o => !o)} className={`p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform ${kycOpen ? 'rotate-180' : ''}`}><ChevronDown size={16} /></button>
                    )}
                  </div>
                  {kycVisible && kycOpen && (
                    <button onClick={() => goTab('kyc')} className={`w-full flex items-center gap-3 pl-11 pr-3.5 py-2.5 mt-0.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${tab === 'kyc' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}>
                      <ShieldCheck size={17} className="shrink-0" /> <span className="flex-1 text-left">KYC Verification</span>
                      {(tabBadges.kyc ?? 0) > 0 && <span className={badgeCls}>{tabBadges.kyc}</span>}
                    </button>
                  )}
                </div>
              )
            })}
            {systemTabs.length > 0 && (
              <div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSystemOpen(o => !o)} className={`flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${systemOpen ? 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}>
                    <Server size={18} className="shrink-0" /> <span className="flex-1 text-left">System</span>
                  </button>
                  <button aria-label="Toggle System submenu" onClick={() => setSystemOpen(o => !o)} className={`p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform ${systemOpen ? 'rotate-180' : ''}`}><ChevronDown size={16} /></button>
                </div>
                {systemOpen && systemTabs.map(t => (
                  <button key={t.id} onClick={() => goTab(t.id)} className={`w-full flex items-center gap-3 pl-11 pr-3.5 py-2.5 mt-0.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${tab === t.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}>
                    <t.icon size={17} className="shrink-0" /> <span className="flex-1 text-left">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
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
