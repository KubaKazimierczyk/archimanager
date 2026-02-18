import { TASK_STATUSES } from '../lib/constants'
import { Activity } from 'lucide-react'
import { predictDays } from '../lib/predictions'

export function StatusBadge({ status }) {
  const s = TASK_STATUSES[status] || TASK_STATUSES.TODO
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}

export function ProgressRing({ progress, size = 36, stroke = 3, color = '#6366F1' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - (progress/100)*circ}
        strokeLinecap="round" className="transition-all duration-500"
      />
    </svg>
  )
}

export function DeadlineBar({ filedDate, legalDays, status }) {
  if (!filedDate || !legalDays) return null
  const elapsed = Math.floor((new Date() - new Date(filedDate)) / 864e5)
  const pct = Math.min(100, (elapsed / legalDays) * 100)
  const barColor = status === 'DONE' ? '#10B981' : elapsed > legalDays ? '#EF4444' : pct > 75 ? '#F59E0B' : '#3B82F6'
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
        <span>{elapsed} dni od złożenia</span>
        <span>Termin: {legalDays} dni</span>
      </div>
      <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
        />
      </div>
    </div>
  )
}

export function PredictionBadge({ appTypeKey, historicalData }) {
  const pred = predictDays(appTypeKey, null, historicalData)
  if (!pred.predicted) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-brand-50 to-indigo-100 text-brand-700">
      <Activity size={10} />
      ~{pred.predicted}d ({pred.lower}–{pred.upper})
    </span>
  )
}

export function Input({ label, className = '', ...props }) {
  return (
    <div>
      {label && <label className="label-field">{label}</label>}
      <input className={`input-field ${className}`} {...props} />
    </div>
  )
}

export function Select({ label, options = [], className = '', ...props }) {
  return (
    <div>
      {label && <label className="label-field">{label}</label>}
      <select className={`input-field cursor-pointer ${className}`} {...props}>
        {options.map(o =>
          typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  )
}

export function InfoRow({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
      {icon && <span className="text-lg">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-slate-400 font-medium">{label}</div>
        <div className="text-sm text-slate-900 font-semibold mt-0.5 truncate">{value || '—'}</div>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon size={28} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4 text-center max-w-sm">{description}</p>}
      {action}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )
}
