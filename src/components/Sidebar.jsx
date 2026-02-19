import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Plus, FolderOpen, BarChart3, Settings, Building2, AlertTriangle } from 'lucide-react'

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

export default function Sidebar({ projects = [] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname
  const mpzpFailureCount = projects.filter(p => p.plot?.mpzp_status === 'covered' && !p.plot?.mpzp_file_url).length

  return (
    <div className="w-[260px] bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 tracking-tight">ArchiManager</div>
            <div className="text-[10px] text-slate-400 font-medium tracking-widest">v1.5 PRODUCTION</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-2.5 py-3 flex-1 overflow-y-auto">
        <div className="mb-1.5">
          <span className="text-[10px] font-bold text-slate-300 px-2 uppercase tracking-[1px]">Menu</span>
        </div>
        <NavItem icon={Home} label="Panel główny" active={path === '/'} onClick={() => navigate('/')} />
        <NavItem icon={Plus} label="Nowy projekt" active={path === '/new'} onClick={() => navigate('/new')} />

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
              active={path === `/project/${p.id}`}
              onClick={() => navigate(`/project/${p.id}`)}
              badge={total - done > 0 ? total - done : null}
            />
          )
        })}

        <div className="mt-4 mb-1.5">
          <span className="text-[10px] font-bold text-slate-300 px-2 uppercase tracking-[1px]">System</span>
        </div>
        <NavItem icon={BarChart3} label="Analityka ML" active={path === '/analytics'} onClick={() => navigate('/analytics')} />
        <NavItem icon={AlertTriangle} label="Import MPZP — błędy" active={path === '/mpzp-failures'} onClick={() => navigate('/mpzp-failures')} badge={mpzpFailureCount} />
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
