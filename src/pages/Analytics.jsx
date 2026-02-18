import { APPLICATION_TYPES } from '../lib/constants'
import { predictDays } from '../lib/predictions'
import { TrendingUp, Database, Activity, Info } from 'lucide-react'

export default function Analytics({ projects = [], historicalData = [] }) {
  const appTypes = ['ZJAZD', 'WOD_KAN', 'ENERGIA']
  const stats = appTypes.map(key => {
    const type = APPLICATION_TYPES[key]
    const data = historicalData.filter(h => h.type === key)
    const pred = predictDays(key, null, historicalData)
    const avg = data.length ? Math.round(data.reduce((s, h) => s + h.actualDays, 0) / data.length) : null
    const min = data.length ? Math.min(...data.map(h => h.actualDays)) : null
    const max = data.length ? Math.max(...data.map(h => h.actualDays)) : null
    return { key, type, data, pred, avg, min, max }
  })

  return (
    <div className="pb-10">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-slate-900 tracking-tight">Analityka ML</h1>
        <p className="text-slate-500 mt-1 text-sm">Model predykcyjny i dane historyczne</p>
      </div>
      <div className="card p-6 mb-5">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-brand-500" /> O modelu
        </h2>
        <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Typ modelu</div>
            <div className="font-semibold text-slate-900">Bayesian Estimation</div>
            <p className="text-xs text-slate-500 mt-1">Prior na terminie ustawowym, posterior z danych historycznych.</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cechy</div>
            <div className="font-semibold text-slate-900">Typ wniosku + Gmina</div>
            <p className="text-xs text-slate-500 mt-1">Przyszłe: sezonowość, wielkość gminy, MPZP.</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dane treningowe</div>
            <div className="font-semibold text-slate-900">{historicalData.length} obserwacji</div>
            <p className="text-xs text-slate-500 mt-1">Każdy zamknięty wniosek zasila model.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {stats.map(({ key, type, data, pred, avg, min, max }) => {
          const Icon = type.icon
          return (
            <div key={key} className="card p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: type.color + '15' }}>
                  <Icon size={18} style={{ color: type.color }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{type.label}</div>
                  <div className="text-[11px] text-slate-400">{data.length} obserwacji</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-brand-50 to-indigo-50 rounded-xl p-4 mb-3">
                <div className="text-[11px] font-bold text-brand-600 uppercase tracking-wider mb-1">Predykcja</div>
                <div className="text-2xl font-bold text-indigo-900">{pred.predicted ?? '—'} <span className="text-sm font-normal text-brand-500">dni</span></div>
                <div className="text-[11px] text-brand-500 mt-0.5">Przedział: {pred.lower}–{pred.upper} · Pewność: {Math.round(pred.confidence * 100)}%</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{ l: 'Średnia', v: avg, c: 'text-slate-900' }, { l: 'Min', v: min, c: 'text-emerald-600' }, { l: 'Max', v: max, c: 'text-amber-600' }].map((s, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-slate-400 font-semibold">{s.l}</div>
                    <div className={`text-sm font-bold ${s.c}`}>{s.v ?? '—'}</div>
                  </div>
                ))}
              </div>
              {data.length > 0 && (
                <div className="mt-3 flex items-end gap-1 h-12">
                  {data.map((h, i) => {
                    const pct = type.legalDays ? (h.actualDays / type.legalDays) * 100 : 50
                    return <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.min(100, Math.max(20, pct))}%`, background: type.color, opacity: 0.6 }} title={`${h.actualDays}d — ${h.municipality}`} />
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Database size={16} className="text-slate-400" />
          <h3 className="text-[15px] font-semibold text-slate-900">Dane historyczne</h3>
          <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{historicalData.length} rekordów</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Typ</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gmina</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Czas (dni)</th>
              <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">vs. termin</th>
            </tr>
          </thead>
          <tbody>
            {historicalData.map((h, i) => {
              const type = APPLICATION_TYPES[h.type]
              const Icon = type?.icon || Activity
              const pct = type?.legalDays ? Math.round((h.actualDays / type.legalDays) * 100) : null
              return (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 flex items-center gap-2"><Icon size={14} style={{ color: type?.color }} /><span className="font-medium text-slate-900">{type?.label || h.type}</span></td>
                  <td className="px-5 py-3 text-slate-500">{h.municipality}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900">{h.actualDays} dni</td>
                  <td className="px-5 py-3">{pct !== null && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pct <= 75 ? 'bg-emerald-50 text-emerald-700' : pct <= 100 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{pct}%</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
