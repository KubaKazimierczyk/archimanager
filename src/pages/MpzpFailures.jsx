import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, ExternalLink, CheckCircle, Loader, ChevronRight, FileX, Info } from 'lucide-react'
import { db } from '../lib/database'
import { storeMpzpPdf } from '../lib/mpzp'
import { LoadingSpinner } from '../components/ui'
import toast from 'react-hot-toast'

const REASON_LABELS = {
  brak_url_aktu: 'Brak URL aktu MPZP',
  blad_pobierania_pdf: 'Błąd pobierania PDF',
}

export default function MpzpFailures({ onRetried }) {
  const navigate = useNavigate()
  const [failures, setFailures] = useState([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await db.getMpzpFailures()
    setFailures(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const retry = async (project) => {
    const actUrl = project.plot?.mpzp_act_url
    if (!actUrl) {
      toast('Brak URL aktu — nie można ponowić automatycznie', { icon: '⚠️' })
      return
    }
    setRetrying(r => ({ ...r, [project.id]: true }))
    const safeName = (project.plot?.mpzp_plan_name || 'uchwala_mpzp')
      .replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60)
    const filename = `${safeName}.pdf`
    const url = await storeMpzpPdf(project.id, actUrl, filename)
    if (url) {
      await db.updateProject(project.id, {
        plot: {
          ...project.plot,
          mpzp_file_url: url,
          mpzp_file_name: filename,
          mpzp_file_path: `mpzp/${project.id}/${filename}`,
          mpzp_import_failed: false,
          mpzp_failure_reason: null,
          mpzp_failure_date: null,
        },
      })
      toast.success('PDF zaimportowany!')
      if (onRetried) await onRetried()
      await load()
    } else {
      toast.error('Ponowna próba nie powiodła się')
    }
    setRetrying(r => ({ ...r, [project.id]: false }))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="pb-10">
      <div className="mb-7">
        <h1 className="text-[28px] font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <AlertTriangle size={24} className="text-amber-500" />
          Import MPZP — błędy
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Projekty, dla których MPZP zostało wykryte, ale plik PDF nie załączył się automatycznie.
        </p>
      </div>

      {failures.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-700 mb-1">Brak nieudanych importów</div>
          <div className="text-sm text-slate-400">Wszystkie projekty z MPZP mają zaimportowany PDF.</div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              <span className="font-semibold text-amber-600">{failures.length}</span> {failures.length === 1 ? 'projekt wymaga' : 'projektów wymaga'} uwagi
            </div>
            <button onClick={load} className="btn-secondary text-xs flex items-center gap-1.5">
              <RefreshCw size={13} /> Odśwież
            </button>
          </div>

          <div className="card overflow-hidden">
            {failures.map((project, i) => {
              const pl = project.plot || {}
              const reason = pl.mpzp_failure_reason
              const actUrl = pl.mpzp_act_url
              const failDate = pl.mpzp_failure_date
                ? new Date(pl.mpzp_failure_date).toLocaleDateString('pl')
                : new Date(project.created_at).toLocaleDateString('pl')
              const isRetrying = retrying[project.id]

              return (
                <div key={project.id} className={`px-5 py-4 flex items-start gap-4 ${i < failures.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  {/* Status icon */}
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileX size={16} className="text-amber-500" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-slate-900">dz. {pl.number || '—'}</span>
                      {pl.precinct && <span className="text-[11px] text-slate-400">obr. {pl.precinct}</span>}
                      {pl.teryt_id && (
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{pl.teryt_id}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5">
                      {[pl.commune_name, pl.county_name && `pow. ${pl.county_name}`, pl.voivodeship && `woj. ${pl.voivodeship}`]
                        .filter(Boolean).join(' · ')}
                    </div>
                    {pl.mpzp_plan_name && (
                      <div className="text-[12px] text-slate-500 mt-0.5">Plan: {pl.mpzp_plan_name}</div>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {/* Failure reason badge */}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        reason === 'brak_url_aktu'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {REASON_LABELS[reason] || 'Błąd importu'}
                      </span>

                      {/* Parser format badge */}
                      {pl.mpzp_kimpzp_format && (
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
                          format: {pl.mpzp_kimpzp_format}
                        </span>
                      )}

                      {/* Date */}
                      <span className="text-[11px] text-slate-400">{failDate}</span>

                      {/* Act URL link */}
                      {actUrl && (
                        <a
                          href={actUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-brand-600 hover:underline flex items-center gap-0.5"
                        >
                          <ExternalLink size={10} /> URL aktu
                        </a>
                      )}
                    </div>

                    {/* No URL info */}
                    {reason === 'brak_url_aktu' && (
                      <div className="mt-2 text-[11px] text-slate-400 flex items-start gap-1">
                        <Info size={11} className="mt-0.5 flex-shrink-0" />
                        KIMPZP nie zwrócił linku do aktu. Sprawdź ręcznie na geoportalu gminy lub BIP.
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => retry(project)}
                      disabled={isRetrying || !actUrl}
                      title={!actUrl ? 'Brak URL — ponowna próba niemożliwa' : 'Ponów pobieranie PDF'}
                      className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {isRetrying ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {isRetrying ? 'Pobieram...' : 'Ponów'}
                    </button>
                    <button
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <ChevronRight size={12} /> Projekt
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Diagnostic note */}
          <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 px-5 py-4 text-[12px] text-slate-500 leading-relaxed">
            <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Info size={13} /> Jak diagnozować nieudane importy?
            </div>
            <ul className="space-y-1 list-disc list-inside">
              <li><span className="font-medium text-orange-600">Brak URL aktu</span> — KIMPZP wykrył MPZP, ale dana gmina nie publikuje linku w WMS. Sprawdź BIP gminy ręcznie.</li>
              <li><span className="font-medium text-red-600">Błąd pobierania PDF</span> — URL aktu jest znany, ale serwer nie zwrócił pliku PDF. Otwórz URL aktu w przeglądarce i sprawdź, czy strona działa.</li>
              <li>Kolumna <span className="font-mono bg-white px-1 rounded">format:</span> pokazuje, który parser KIMPZP był użyty — pomocne przy debugowaniu.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
