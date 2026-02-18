import { useNavigate } from 'react-router-dom'
import { FolderOpen, FileText, Clock, CheckCircle, ChevronRight, TrendingUp, Activity, Plus } from 'lucide-react'
import { APPLICATION_TYPES } from '../lib/constants'
import { predictDays } from '../lib/predictions'
import { ProgressRing, LoadingSpinner, EmptyState } from '../components/ui'

export default function Dashboard({ projects = [], historicalData = [], loading }) {
  const navigate = useNavigate()

  if (loading) return <LoadingSpinner />

  const totalApps = projects.reduce((s, p) => s + (p.applications?.length || 0), 0)
  const waitingApps = projects.reduce((s, p) => s + (p.applications?.filter(a => a.status === 'WAITING' || a.status === 'IN_PROGRESS').length || 0), 0)
  const doneApps = projects.reduce((s, p) => s + (p.applications?.filter(a => a.status === 'DONE').length || 0), 0)

  const upcomingDeadlines = projects.flatMap(p =>
    (p.applications || [])
      .filter(a => a.filed_date && a.status !== 'DONE' && APPLICATION_TYPES[a.type]?.legalDays)
      .map(a => {
        const type = APPLICATION_TYPES[a.type]
        const deadline = new Date(new Date(a.filed_date).getTime() + type.legalDays * 864e5)
        return { ...a, projectName: p.name, projectId: p.id, typeInfo: type, deadline }
      })
  ).sort((a, b) => a.deadline - b.deadline)

  const stats = [
    { label: 'Projekty', value: projects.length, icon: FolderOpen, color: '#6366F1', bg: 'bg-brand-50' },
    { label: 'Wnioski łącznie', value: totalApps, icon: FileText, color: '#3B82F6', bg: 'bg-blue-50' },
    { label: 'Oczekujące', value: waitingApps, icon: Clock, color: '#F59E0B', bg: 'bg-amber-50' },
    { label: 'Zakończone', value: doneApps, icon: CheckCircle, color: '#10B981', bg: 'bg-emerald-50' },
  ]

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Panel główny</h1>
        <p className="text-slate-500 mt-1 text-sm">Przegląd projektów, wniosków i terminów</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {stats.map((stat, i) => (
          <div key={i} className="card p-5 relative overflow-hidden">
            <div className={`absolute -top-2 -right-2 w-16 h-16 rounded-full ${stat.bg} opacity-70`} />
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3 relative`}>
              <stat.icon size={18} style={{ color: stat.color }} />
            </div>
            <div className="text-[28px] font-bold text-slate-900 relative">{stat.value}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5 relative">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Projects list */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-slate-900">Projekty</h3>
            <button onClick={() => navigate('/new')} className="text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1">
              <Plus size={14} /> Nowy
            </button>
          </div>
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Brak projektów"
              description="Utwórz pierwszy projekt, aby rozpocząć"
              action={<button onClick={() => navigate('/new')} className="btn-primary text-sm">Nowy projekt</button>}
            />
          ) : (
            projects.map(p => {
              const done = (p.applications || []).filter(a => a.status === 'DONE').length
              const total = (p.applications || []).length
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="px-5 py-4 border-b border-slate-50 cursor-pointer flex items-center gap-3.5 hover:bg-slate-50/80 transition-colors"
                >
                  <ProgressRing progress={total ? Math.round((done/total)*100) : 0} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.client?.city} · {done}/{total} wniosków</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              )
            })
          )}
        </div>

        {/* Deadlines */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-[15px] font-semibold text-slate-900">Nadchodzące terminy</h3>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Brak bieżących terminów</div>
          ) : (
            upcomingDeadlines.slice(0, 6).map((d, i) => {
              const daysLeft = Math.ceil((d.deadline - new Date()) / 864e5)
              const isUrgent = daysLeft <= 7
              const Icon = d.typeInfo?.icon || FileText
              return (
                <div key={i} className="px-5 py-3.5 border-b border-slate-50 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUrgent ? 'bg-red-50' : 'bg-slate-50'}`}>
                    <Icon size={15} style={{ color: isUrgent ? '#EF4444' : d.typeInfo?.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 truncate">{d.typeInfo?.label}</div>
                    <div className="text-[11px] text-slate-400">{d.projectName}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[13px] font-semibold ${isUrgent ? 'text-red-500' : 'text-slate-900'}`}>
                      {daysLeft > 0 ? `${daysLeft} dni` : 'Termin minął!'}
                    </div>
                    <div className="text-[11px] text-slate-400">{d.deadline.toISOString().split('T')[0]}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ML Panel */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-brand-700 to-brand-500 p-6 text-white">
        <div className="flex items-center gap-2.5 mb-4">
          <TrendingUp size={20} />
          <h3 className="text-base font-semibold">Predykcje ML — średnie czasy odpowiedzi urzędów</h3>
        </div>
        <p className="text-xs text-indigo-200 mb-5 leading-relaxed">
          Model bayesowski. Prior: termin ustawowy. Posterior: aktualizowany danymi z {historicalData.length} ukończonych wniosków.
        </p>
        <div className="grid grid-cols-3 gap-3.5">
          {['ZJAZD', 'WOD_KAN', 'ENERGIA'].map(key => {
            const pred = predictDays(key, null, historicalData)
            const type = APPLICATION_TYPES[key]
            const Icon = type.icon
            return (
              <div key={key} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <Icon size={16} style={{ color: type.color }} />
                  <span className="text-xs font-medium text-indigo-200">{type.label}</span>
                </div>
                <div className="text-2xl font-bold">
                  {pred.predicted} <span className="text-sm font-normal text-indigo-200">dni</span>
                </div>
                <div className="text-[11px] text-indigo-300 mt-1">
                  Przedział: {pred.lower}–{pred.upper} · Pewność: {Math.round(pred.confidence * 100)}%
                </div>
                <div className="mt-2 h-0.5 bg-white/15 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${pred.confidence * 100}%`, background: type.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
