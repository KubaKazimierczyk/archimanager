import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Plus, FolderOpen, BarChart3, Settings, Building2, AlertTriangle, X } from 'lucide-react'

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-4 py-2.5 border-none rounded-lg cursor-pointer text-[13px] transition-all duration-150 ${
        active
          ? 'bg-brand-500/10 text-brand-600 font-semibold'
          : 'bg-transparent text-slate-500 font-normal hover:bg-slate-50'
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span className="truncate flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  )
}

export default function Sidebar({ projects = [], open, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname
  const mpzpFailureCount = projects.filter(p => p.plot?.mpzp_status === 'covered' && !p.plot?.mpzp_file_url).length

  const nav = (to) => {
    navigate(to)
    onClose?.()
  }

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-slate-200 flex flex-col flex-shrink-0
      transition-transform duration-200 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full'}
      md:relative md:translate-x-0 md:h-screen md:z-auto
    `}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 tracking-tight">ArchiManager</div>
            <div className="text-[10px] text-slate-400 font-medium tracking-widest">v1.5 PRODUCTION</div>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <div className="px-2.5 py-3 flex-1 overflow-y-auto">
        <div className="mb-1.5">
          <span className="text-[10px] font-bold text-slate-300 px-2 uppercase tracking-[1px]">Menu</span>
        </div>
        <NavItem icon={Home} label="Panel główny" active={path === '/'} onClick={() => nav('/')} />
        <NavItem icon={Plus} label="Nowy projekt" active={path === '/new'} onClick={() => nav('/new')} />

        <div className="mt-4 mb-1.5">
          <span className="text-[10px] font-bold text-slate-300 px-2 uppercase tracking-[1px]">Projekty</span>
        </div>
        {projects.map(p => {
          const done = (p.applications || []).filter(a => a.status === 'DONE').length
          const total = (p.applications || []).length
          return (
            <NavItem
              key={p.id}
              icon={FolderOpen}
              label={p.name}
              active={path === `/project/${p.id}` || path.startsWith(`/project/${p.id}/`)}
              onClick={() => nav(`/project/${p.id}`)}
              badge={total - done > 0 ? total - done : null}
            />
          )
        })}

        <div className="mt-4 mb-1.5">
          <span className="text-[10px] font-bold text-slate-300 px-2 uppercase tracking-[1px]">System</span>
        </div>
        <NavItem icon={BarChart3} label="Analityka ML" active={path === '/analytics'} onClick={() => nav('/analytics')} />
        <NavItem icon={AlertTriangle} label="Import MPZP — błędy" active={path === '/mpzp-failures'} onClick={() => nav('/mpzp-failures')} badge={mpzpFailureCount} />
        <NavItem icon={Settings} label="Ustawienia" active={false} onClick={() => {}} />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
        <div className="font-semibold text-slate-500">React + Supabase + Netlify</div>
        <div>ML predictions · TERYT API · e-Mapa</div>
      </div>
    </div>
  )
}
