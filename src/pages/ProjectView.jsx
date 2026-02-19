import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ChevronDown, User, MapPin, FileText, Flag,
  Download, Eye, Edit3, Save, Calendar, Clock, CheckCircle, Circle,
  Info, TrendingUp, AlertTriangle, Activity, Upload, FileDown, X,
  Bot, Send, Sparkles, Loader2,
} from 'lucide-react'
import { APPLICATION_TYPES, MILESTONES, ROAD_CLASSES, BUILDING_TYPES } from '../lib/constants'
import { predictDays } from '../lib/predictions'
import { db } from '../lib/database'
import { downloadWniosekZjazd } from '../lib/pdf-generator'
import { StatusBadge, DeadlineBar, InfoRow, LoadingSpinner, Input, Select } from '../components/ui'
import toast from 'react-hot-toast'

export default function ProjectView({ projects = [], historicalData = [], onUpdated }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('milestones')
  const [expandedApp, setExpandedApp] = useState(null)
  const [editingApp, setEditingApp] = useState(null)
  const [editDates, setEditDates] = useState({})
  const [editingPlot, setEditingPlot] = useState(false)
  const [plotDraft, setPlotDraft] = useState(null)
  const [savingPlot, setSavingPlot] = useState(false)
  const [uploadingMpzp, setUploadingMpzp] = useState(false)
  const [analyzingMpzp, setAnalyzingMpzp] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const mpzpFileRef = useRef(null)
  const chatEndRef = useRef(null)

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id])

  // Load saved chat history when project changes
  useEffect(() => {
    if (project?.plot?.mpzp_chat) {
      setChatMessages(project.plot.mpzp_chat)
    } else {
      setChatMessages([])
    }
  }, [project?.id])

  if (!project) return <LoadingSpinner />

  const tabs = [
    { id: 'client', label: 'Dane klienta', icon: User },
    { id: 'plot', label: 'Dane działki', icon: MapPin },
    { id: 'applications', label: 'Wnioski', icon: FileText },
    { id: 'milestones', label: 'Kamienie milowe', icon: Flag },
  ]

  const startEditDates = (app) => {
    setEditingApp(app.id)
    setEditDates({ filed_date: app.filed_date || '', response_date: app.response_date || '', notes: app.notes || '' })
  }

  const saveDates = async (appId) => {
    await db.updateApplication(project.id, appId, editDates)
    setEditingApp(null)
    toast.success('Daty zapisane')
    if (onUpdated) await onUpdated()
  }

  const startEditPlot = () => {
    setPlotDraft({ ...pl })
    setEditingPlot(true)
  }

  const cancelEditPlot = () => {
    setEditingPlot(false)
    setPlotDraft(null)
  }

  const savePlot = async () => {
    setSavingPlot(true)
    await db.updateProject(project.id, { plot: plotDraft })
    setSavingPlot(false)
    setEditingPlot(false)
    setPlotDraft(null)
    toast.success('Dane działki zapisane')
    if (onUpdated) await onUpdated()
  }

  const upPlot = (field, val) => setPlotDraft(d => ({ ...d, [field]: val }))

  const handleAnalyzeMpzp = async (pdfUrl, currentPlot) => {
    setAnalyzingMpzp(true)
    const toastId = toast.loading('Analizuję plik MPZP…')
    try {
      const { data, error } = await db.analyzeMpzpFile(pdfUrl)
      if (error || !data?.extracted) {
        toast.error('Nie udało się przeanalizować PDF — sprawdź klucz API', { id: toastId })
        return
      }
      // Filter out null/empty fields so we don't overwrite existing manual data
      const extracted = Object.fromEntries(
        Object.entries(data.extracted).filter(([, v]) => v !== null && v !== undefined && v !== '')
      )
      // Always mark has_mpzp = true since we just analyzed an MPZP document
      const updatedPlot = { ...currentPlot, has_mpzp: true, ...extracted }
      await db.updateProject(project.id, { plot: updatedPlot })
      toast.success('Dane MPZP wyodrębnione z pliku PDF', { id: toastId })
      if (onUpdated) await onUpdated()
    } catch {
      toast.error('Błąd analizy PDF', { id: toastId })
    } finally {
      setAnalyzingMpzp(false)
    }
  }

  const handleMpzpChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const question = chatInput.trim()
    setChatInput('')
    const userMsg = { role: 'user', text: question }
    const msgsWithUser = [...chatMessages, userMsg]
    setChatMessages(msgsWithUser)
    setChatLoading(true)
    try {
      const { data, error } = await db.chatMpzpFile(pl.mpzp_file_url, question, pl)
      const aiMsg = {
        role: 'ai',
        text: error || !data?.answer
          ? 'Przepraszam, nie udało się uzyskać odpowiedzi. Sprawdź konfigurację klucza API Anthropic.'
          : data.answer,
      }
      const finalMsgs = [...msgsWithUser, aiMsg]
      setChatMessages(finalMsgs)
      // Save chat history silently (no onUpdated to avoid re-render)
      db.updateProject(project.id, { plot: { ...pl, mpzp_chat: finalMsgs } })
    } finally {
      setChatLoading(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handleMpzpUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Wymagany plik PDF')
      return
    }
    setUploadingMpzp(true)
    try {
      const { data, error } = await db.uploadMpzpFile(project.id, file)
      if (error || !data) {
        toast.error('Błąd przesyłania pliku')
        return
      }
      const { data: url } = await db.getMpzpFileUrl(data.path)
      const updatedPlot = { ...pl, mpzp_file_name: data.name, mpzp_file_path: data.path, mpzp_file_url: url || '' }
      await db.updateProject(project.id, { plot: updatedPlot })
      toast.success('Plik MPZP zapisany — trwa analiza AI…')
      if (onUpdated) await onUpdated()
      if (url) handleAnalyzeMpzp(url, updatedPlot)
    } finally {
      setUploadingMpzp(false)
      if (mpzpFileRef.current) mpzpFileRef.current.value = ''
    }
  }

  const getMilestoneStatus = (ms) => {
    const pm = (project.milestones || []).find(m => m.id === ms.id)
    return pm?.status || 'TODO'
  }

  const c = project.client || {}
  const pl = project.plot || {}

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-700">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 truncate">{project.name}</h1>
          <p className="text-slate-400 mt-0.5 text-[13px]">{c.city} · Utworzono {project.created_at}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={15} />{tab.label}
          </button>
        ))}
      </div>

      {/* ── CLIENT TAB ─────────────────────────────── */}
      {activeTab === 'client' && (
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2.5">
            <User size={20} className="text-brand-500" /> Dane klienta (inwestora)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: 'Imię i nazwisko', v: `${c.first_name} ${c.last_name}` },
              { l: 'PESEL', v: c.pesel },
              { l: 'NIP', v: c.nip || '—' },
              { l: 'Adres', v: `ul. ${c.street} ${c.number}, ${c.postal_code} ${c.city}` },
              { l: 'Województwo', v: c.province },
              { l: 'Telefon', v: c.phone },
              { l: 'Email', v: c.email },
              { l: 'Tytuł prawny', v: c.property_title },
              { l: 'Nr KW', v: c.land_register },
            ].map((f, i) => (
              <div key={i} className="px-4 py-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{f.l}</div>
                <div className="text-[15px] text-slate-900 mt-1 font-medium">{f.v || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLOT TAB ───────────────────────────────── */}
      {activeTab === 'plot' && (
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2.5">
              <MapPin size={20} className="text-brand-500" /> Dane działki
            </h2>
            {!editingPlot ? (
              <button onClick={startEditPlot} className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-brand-100">
                <Edit3 size={14} /> Edytuj dane
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={cancelEditPlot} className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-200">
                  <X size={14} /> Anuluj
                </button>
                <button onClick={savePlot} disabled={savingPlot} className="text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Save size={14} /> {savingPlot ? 'Zapisuję...' : 'Zapisz zmiany'}
                </button>
              </div>
            )}
          </div>

          {!editingPlot ? (
            <>
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  { l: 'Nr działki', v: pl.number },
                  { l: 'Powierzchnia', v: pl.area ? `${pl.area} m²` : '—' },
                  { l: 'Obręb', v: pl.precinct },
                  { l: 'Nr KW', v: pl.land_register },
                ].map((f, i) => (
                  <div key={i} className="px-4 py-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{f.l}</div>
                    <div className="text-lg text-slate-900 mt-1.5 font-bold">{f.v || '—'}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <InfoRow label="Typ budynku" value={pl.building_type} icon="🏠" />
                <InfoRow label="Droga" value={pl.road_name ? `${pl.road_class} — ${pl.road_name}` : pl.road_class || '—'} icon="🛣️" />
                <InfoRow label="Nr dz. drogowej" value={pl.road_plot_number} icon="📍" />
                <InfoRow label="Zapotrzebowanie wody" value={pl.water_demand ? `${pl.water_demand} m³/d` : '—'} icon="💧" />
                <InfoRow label="Moc przyłączeniowa" value={pl.power_demand ? `${pl.power_demand} kW` : '—'} icon="⚡" />
                <InfoRow label="Liczba mieszkańców" value={pl.residents} icon="👥" />
              </div>

              {/* MPZP Status */}
              <div className={`rounded-xl px-4 py-3.5 mb-5 flex items-center gap-2.5 ${pl.has_mpzp ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {pl.has_mpzp ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-red-500" />}
                <span className={`text-sm font-semibold ${pl.has_mpzp ? 'text-emerald-800' : 'text-red-800'}`}>
                  {pl.has_mpzp ? 'Teren objęty MPZP' : 'Brak MPZP — wymagane warunki zabudowy'}
                </span>
              </div>

              {/* MPZP File — hidden input */}
              <input
                ref={mpzpFileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleMpzpUpload}
              />

              {/* MPZP File Preview */}
              {pl.mpzp_file_name ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden mb-5">
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                    <FileText size={18} className="text-brand-500" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{pl.mpzp_file_name}</div>
                      <div className="text-[11px] text-slate-400">Miejscowy Plan Zagospodarowania Przestrzennego</div>
                    </div>
                    {pl.mpzp_file_url && (
                      <a
                        href={pl.mpzp_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-brand-100"
                      >
                        <Eye size={13} /> Podgląd
                      </a>
                    )}
                    {pl.mpzp_file_url && (
                      <a
                        href={pl.mpzp_file_url}
                        download={pl.mpzp_file_name}
                        className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-brand-100"
                      >
                        <Download size={13} /> Pobierz
                      </a>
                    )}
                    {pl.mpzp_file_url && (
                      <button
                        onClick={() => handleAnalyzeMpzp(pl.mpzp_file_url, pl)}
                        disabled={analyzingMpzp}
                        title="Wyodrębnij parametry MPZP z pliku PDF przy pomocy AI"
                        className="text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-violet-100 disabled:opacity-60"
                      >
                        {analyzingMpzp ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {analyzingMpzp ? 'Analizuję…' : 'Analizuj AI'}
                      </button>
                    )}
                    <button
                      onClick={() => mpzpFileRef.current?.click()}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100"
                      title="Zastąp plik"
                    >
                      <Upload size={13} />
                    </button>
                  </div>
                  {pl.mpzp_file_url ? (
                    <iframe
                      src={pl.mpzp_file_url}
                      className="w-full h-72 border-0"
                      title="Podgląd MPZP"
                    />
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-2">
                      <FileText size={40} className="text-slate-400" />
                      <span className="text-[13px] text-slate-500 font-medium">{pl.mpzp_file_name}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-indigo-200 rounded-xl px-5 py-4 mb-5 bg-indigo-50/30 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <FileDown size={22} className="text-brand-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">Prześlij plik MPZP</div>
                    <div className="text-xs text-slate-400 mt-0.5">PDF z uchwałą zostanie zapisany w projekcie</div>
                  </div>
                  <button
                    onClick={() => mpzpFileRef.current?.click()}
                    disabled={uploadingMpzp}
                    className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <Upload size={14} /> {uploadingMpzp ? 'Przesyłanie…' : 'Prześlij PDF'}
                  </button>
                </div>
              )}

              {/* MPZP Parameters */}
              {pl.has_mpzp && (
                <div className="space-y-3">
                  {/* Symbol terenu */}
                  {pl.teren && (
                    <div className="px-4 py-3 bg-brand-50 rounded-xl border border-brand-100 flex items-center gap-3">
                      <span className="text-lg">🗂️</span>
                      <div>
                        <div className="text-[11px] text-brand-500 font-semibold uppercase tracking-wider">Teren</div>
                        <div className="text-xl font-bold text-brand-700 tracking-wide">{pl.teren}</div>
                      </div>
                    </div>
                  )}
                  {/* Przeznaczenie */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Przeznaczenie terenu" value={pl.purpose} icon="📋" />
                    <InfoRow label="Przeznaczenie dopuszczalne" value={pl.purpose_allowed} icon="📝" />
                  </div>
                  {/* Zasady użytkowania — full width, multi-line */}
                  {pl.usage_rules && (
                    <div className="px-4 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div className="text-[11px] text-slate-400 font-medium mb-1">📜 Zasady użytkowania i zagospodarowania terenu</div>
                      <div className="text-sm text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">{pl.usage_rules}</div>
                    </div>
                  )}
                  {/* Parametry zabudowy */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Wysokość zabudowy" value={pl.building_height} icon="📏" />
                    <InfoRow label="Wysokość budynku / kalenicy" value={pl.ridge_height} icon="🏔️" />
                    <InfoRow label="Długość elewacji frontowej" value={pl.facade_length} icon="↔️" />
                    <InfoRow label="Geometria dachu" value={pl.roof_geometry} icon="🏠" />
                    <InfoRow label="Kąt nachylenia połaci dachowej" value={pl.roof_angle} icon="📐" />
                    <InfoRow label="Intensywność zabudowy" value={pl.intensity} icon="📊" />
                    <InfoRow label="Powierzchnia zabudowy" value={pl.building_coverage ? `${pl.building_coverage}%` : null} icon="🏗️" />
                    <InfoRow label="Pow. biologicznie czynna" value={pl.bio_area ? `${pl.bio_area}%` : null} icon="🌿" />
                    <InfoRow label="Lokalizacja względem działek sąsiednich" value={pl.building_location} icon="🗺️" />
                    <InfoRow label="Linia zabudowy" value={pl.building_line} icon="📍" />
                    <InfoRow label="Ilość miejsc parkingowych" value={pl.parking} icon="🚗" />
                  </div>
                </div>
              )}

              {/* MPZP AI Chat */}
              {pl.has_mpzp && pl.mpzp_file_url && (
                <div className="mt-6 border border-violet-200 rounded-2xl overflow-hidden">
                  {/* Chat header */}
                  <div className="px-5 py-3.5 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">Zapytaj o plan MPZP</div>
                      <div className="text-[11px] text-slate-400">AI analizuje treść dokumentu i odpowiada na pytania</div>
                    </div>
                    {chatMessages.length > 0 && (
                      <button
                        onClick={() => {
                          setChatMessages([])
                          db.updateProject(project.id, { plot: { ...pl, mpzp_chat: [] } })
                        }}
                        className="text-[11px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-white/60"
                      >
                        Wyczyść
                      </button>
                    )}
                  </div>

                  {/* Messages */}
                  {chatMessages.length > 0 && (
                    <div className="px-4 py-4 space-y-3 max-h-80 overflow-y-auto bg-white">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'ai' && (
                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Bot size={14} className="text-violet-600" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'bg-violet-600 text-white rounded-br-md'
                                : 'bg-slate-100 text-slate-900 rounded-bl-md'
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex gap-2.5 justify-start">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Bot size={14} className="text-violet-600" />
                          </div>
                          <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-md flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  {/* Input */}
                  <div className={`px-4 py-3 flex gap-2 ${chatMessages.length > 0 ? 'border-t border-slate-100 bg-white' : 'bg-violet-50/30'}`}>
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleMpzpChat()}
                      placeholder="np. Czy mogę zbudować garaż wolnostojący? Jaka jest linia zabudowy?"
                      disabled={chatLoading}
                      className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 placeholder:text-slate-400 disabled:opacity-60"
                    />
                    <button
                      onClick={handleMpzpChat}
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium"
                    >
                      {chatLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── EDIT MODE ── */
            <div className="space-y-6">
              {/* Dane podstawowe */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <MapPin size={15} className="text-brand-500" /> Dane podstawowe
                </h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <Input label="Nr działki *" value={plotDraft.number || ''} onChange={e => upPlot('number', e.target.value)} placeholder="123/4" />
                  <Input label="Obręb *" value={plotDraft.precinct || ''} onChange={e => upPlot('precinct', e.target.value)} placeholder="Piaseczno" />
                  <Input label="Powierzchnia (m²)" value={plotDraft.area || ''} onChange={e => upPlot('area', e.target.value)} placeholder="1200" />
                  <Input label="Nr KW" value={plotDraft.land_register || ''} onChange={e => upPlot('land_register', e.target.value)} placeholder="WA1I/..." />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <Input label="Województwo" value={plotDraft.voivodeship || ''} onChange={e => upPlot('voivodeship', e.target.value)} />
                  <Input label="Powiat" value={plotDraft.county_name || ''} onChange={e => upPlot('county_name', e.target.value)} />
                  <Input label="Gmina" value={plotDraft.commune_name || ''} onChange={e => upPlot('commune_name', e.target.value)} />
                  <Input label="Użytki gruntowe" value={plotDraft.land_use || ''} onChange={e => upPlot('land_use', e.target.value)} placeholder="R, Ps, B" />
                </div>
              </div>

              {/* Budynek i media */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  🏠 Budynek i media
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <Select label="Typ budynku" value={plotDraft.building_type || ''} onChange={e => upPlot('building_type', e.target.value)} options={BUILDING_TYPES} />
                  <Input label="Liczba mieszkańców" type="number" value={plotDraft.residents || ''} onChange={e => upPlot('residents', e.target.value)} />
                  <Input label="Zapotrzebowanie wody (m³/d)" value={plotDraft.water_demand || ''} onChange={e => upPlot('water_demand', e.target.value)} placeholder="0.8" />
                  <Input label="Moc przyłączeniowa (kW)" value={plotDraft.power_demand || ''} onChange={e => upPlot('power_demand', e.target.value)} placeholder="14" />
                </div>
              </div>

              {/* Droga dojazdowa */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  🛣️ Droga dojazdowa (zjazd)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <Select label="Klasa drogi" value={plotDraft.road_class || 'Gminna'} onChange={e => upPlot('road_class', e.target.value)} options={ROAD_CLASSES} />
                  <Input label="Nazwa drogi" value={plotDraft.road_name || ''} onChange={e => upPlot('road_name', e.target.value)} placeholder="ul. Lipowa" />
                  <Input label="Nr działki drogowej" value={plotDraft.road_plot_number || ''} onChange={e => upPlot('road_plot_number', e.target.value)} placeholder="300/1" />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Info size={11} /> Te dane trafiają bezpośrednio do wniosku o zjazd z drogi gminnej (PDF).
                </p>
              </div>

              {/* MPZP */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  📋 MPZP
                </h3>
                <div className="flex gap-3 mb-4">
                  <button onClick={() => upPlot('has_mpzp', true)} className={`px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all ${plotDraft.has_mpzp === true ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-400'}`}>Jest MPZP</button>
                  <button onClick={() => upPlot('has_mpzp', false)} className={`px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all ${plotDraft.has_mpzp === false ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 text-slate-400'}`}>Brak (WZ)</button>
                </div>
                {plotDraft.has_mpzp === true && (
                  <div className="space-y-4">
                    <Input label="Teren (symbol z rysunku planu)" value={plotDraft.teren || ''} onChange={e => upPlot('teren', e.target.value)} placeholder="np. 22.39MN/U" />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Przeznaczenie terenu" value={plotDraft.purpose || ''} onChange={e => upPlot('purpose', e.target.value)} placeholder="MN — zabudowa mieszkaniowa jednorodzinna" />
                      <Input label="Przeznaczenie dopuszczalne" value={plotDraft.purpose_allowed || ''} onChange={e => upPlot('purpose_allowed', e.target.value)} placeholder="usługi wbudowane, garaże" />
                    </div>
                    <div>
                      <label className="label-field">Zasady użytkowania i zagospodarowania terenu</label>
                      <textarea
                        className="input-field resize-none"
                        rows={3}
                        value={plotDraft.usage_rules || ''}
                        onChange={e => upPlot('usage_rules', e.target.value)}
                        placeholder="Opis głównych zasad zagospodarowania terenu…"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Wysokość zabudowy" value={plotDraft.building_height || ''} onChange={e => upPlot('building_height', e.target.value)} placeholder="do 9 m" />
                      <Input label="Wysokość budynku / kalenicy" value={plotDraft.ridge_height || ''} onChange={e => upPlot('ridge_height', e.target.value)} placeholder="max 10 m n.p.t." />
                      <Input label="Długość elewacji frontowej" value={plotDraft.facade_length || ''} onChange={e => upPlot('facade_length', e.target.value)} placeholder="max 20 m" />
                      <Input label="Geometria dachu" value={plotDraft.roof_geometry || ''} onChange={e => upPlot('roof_geometry', e.target.value)} placeholder="dwuspadowy, czterospadowy" />
                      <Input label="Kąt nachylenia połaci dachowej" value={plotDraft.roof_angle || ''} onChange={e => upPlot('roof_angle', e.target.value)} placeholder="30°–45°" />
                      <Input label="Intensywność zabudowy" value={plotDraft.intensity || ''} onChange={e => upPlot('intensity', e.target.value)} placeholder="0.4–0.8" />
                      <Input label="Powierzchnia zabudowy (%)" value={plotDraft.building_coverage || ''} onChange={e => upPlot('building_coverage', e.target.value)} placeholder="30" />
                      <Input label="Pow. biologicznie czynna (%)" value={plotDraft.bio_area || ''} onChange={e => upPlot('bio_area', e.target.value)} placeholder="60" />
                      <Input label="Lokalizacja względem działek sąsiednich" value={plotDraft.building_location || ''} onChange={e => upPlot('building_location', e.target.value)} placeholder="min. 4 m od granicy działki" />
                      <Input label="Linia zabudowy" value={plotDraft.building_line || ''} onChange={e => upPlot('building_line', e.target.value)} placeholder="obowiązująca 6 m od drogi" />
                      <Input label="Ilość miejsc parkingowych" value={plotDraft.parking || ''} onChange={e => upPlot('parking', e.target.value)} placeholder="2 na 1 lokal" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── APPLICATIONS TAB ───────────────────────── */}
      {activeTab === 'applications' && (
        <div>
          {(project.applications || []).map((app, idx) => {
            const type = APPLICATION_TYPES[app.type]
            if (!type) return null
            const Icon = type.icon
            const isExpanded = expandedApp === app.id
            const isEditing = editingApp === app.id
            const pred = predictDays(app.type, c.city, historicalData)

            return (
              <div key={app.id} className="mb-3">
                <div className={`card overflow-hidden transition-all ${isExpanded ? 'ring-2' : ''}`} style={{ borderColor: isExpanded ? type.color + '40' : undefined, ringColor: isExpanded ? type.color + '15' : undefined }}>
                  {/* Header */}
                  <div
                    onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                    className="px-5 py-4 cursor-pointer flex items-center gap-3.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: type.color + '15' }}>
                      <Icon size={16} style={{ color: type.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold text-slate-900">{type.label}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      {app.filed_date && <DeadlineBar filedDate={app.filed_date} legalDays={type.legalDays} status={app.status} />}
                    </div>
                    <div className="flex items-center gap-2">
                      {pred.predicted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-brand-50 to-indigo-100 text-brand-700">
                          <Activity size={10} /> ~{pred.predicted}d
                        </span>
                      )}
                      {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-5">
                      <div className="grid grid-cols-2 gap-5">
                        {/* Info */}
                        <div>
                          <h4 className="text-[13px] font-semibold text-slate-600 mb-3">Informacje o wniosku</h4>
                          <div className="text-[13px] text-slate-500 leading-[1.8]">
                            <div><strong>Podstawa prawna:</strong> {type.legalBasis}</div>
                            <div><strong>Opłata:</strong> {type.fee}</div>
                            <div><strong>Termin ustawowy:</strong> {type.legalDays ? `${type.legalDays} dni` : 'Indywidualny'}</div>
                            {type.maxDays && <div><strong>Max. (skomplikowane):</strong> {type.maxDays} dni</div>}
                            {type.appeal && <div><strong>Odwołanie:</strong> {type.appeal}</div>}
                            {type.note && <div className="mt-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-800">{type.note}</div>}
                          </div>
                          {pred.predicted && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-brand-50 to-indigo-100 rounded-xl">
                              <div className="text-xs font-semibold text-brand-700 mb-1.5 flex items-center gap-1.5"><TrendingUp size={14} /> Predykcja ML</div>
                              <div className="text-xl font-bold text-indigo-900">{pred.predicted} dni <span className="text-xs font-normal text-brand-500">({pred.lower}–{pred.upper})</span></div>
                              <div className="text-[11px] text-brand-500 mt-1">Pewność: {Math.round(pred.confidence * 100)}% · {pred.basis}</div>
                            </div>
                          )}
                        </div>

                        {/* Docs */}
                        <div>
                          <h4 className="text-[13px] font-semibold text-slate-600 mb-3">Wymagane dokumenty</h4>
                          <div className="flex flex-col gap-1.5">
                            {type.requiredDocs.map((doc, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
                                <CheckCircle size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />{doc}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (app.type === 'ZJAZD') {
                                downloadWniosekZjazd(c, pl)
                                toast.success('Wniosek o zjazd — PDF wygenerowany!')
                              } else {
                                toast('Generator dla tego typu wniosku w przygotowaniu', { icon: 'ℹ️' })
                              }
                            }}
                            className="w-full mt-4 py-2.5 rounded-lg text-white text-[13px] font-semibold flex items-center justify-center gap-1.5"
                            style={{ background: type.color }}
                          >
                            <Download size={14} /> Pobierz wniosek z danymi
                          </button>
                          <p className="text-[11px] text-slate-400 mt-1.5">Wniosek wypełniony danymi klienta i działki</p>
                        </div>
                      </div>

                      {/* Date tracking */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[13px] font-semibold text-slate-600">Śledzenie wniosku</h4>
                          {!isEditing ? (
                            <button onClick={e => { e.stopPropagation(); startEditDates(app) }} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                              <Edit3 size={12} /> Edytuj daty
                            </button>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); saveDates(app.id) }} className="text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded-lg flex items-center gap-1">
                              <Save size={12} /> Zapisz
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="label-field">Data złożenia wniosku</label>
                              <input type="date" className="input-field" value={editDates.filed_date} onChange={e => setEditDates(d => ({ ...d, filed_date: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label-field">Data odpowiedzi urzędu</label>
                              <input type="date" className="input-field" value={editDates.response_date} onChange={e => setEditDates(d => ({ ...d, response_date: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label-field">Notatki</label>
                              <input className="input-field" value={editDates.notes} onChange={e => setEditDates(d => ({ ...d, notes: e.target.value }))} placeholder="np. Decyzja pozytywna" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-4 flex-wrap text-xs">
                            {app.filed_date && <span className="flex items-center gap-1 text-slate-500"><Calendar size={12} /> Złożono: <strong>{app.filed_date}</strong></span>}
                            {app.response_date && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle size={12} /> Odpowiedź: <strong>{app.response_date}</strong>{app.actual_days != null && ` (${app.actual_days} dni)`}</span>}
                            {app.filed_date && !app.response_date && type.legalDays && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <Clock size={12} /> Termin: <strong>{new Date(new Date(app.filed_date).getTime() + type.legalDays * 864e5).toISOString().split('T')[0]}</strong>
                              </span>
                            )}
                            {app.notes && <span className="flex items-center gap-1 text-brand-500"><Info size={12} /> {app.notes}</span>}
                            {!app.filed_date && <span className="text-slate-400">Wniosek jeszcze nie złożony. Kliknij „Edytuj daty" po złożeniu.</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* Connector */}
                {idx < (project.applications || []).length - 1 && (
                  <div className="flex justify-center py-1">
                    <div className={`w-0.5 h-3 rounded ${app.status === 'DONE' ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── MILESTONES TAB ─────────────────────────── */}
      {activeTab === 'milestones' && (
        <div>
          {MILESTONES.map((ms, idx) => {
            const status = getMilestoneStatus(ms)
            const isActive = status === 'IN_PROGRESS'
            const isDone = status === 'DONE'
            const MsIcon = ms.icon

            return (
              <div key={ms.id} className="relative">
                {idx > 0 && (
                  <div
                    className="absolute left-[23px] -top-4 w-0.5 h-4"
                    style={{ background: MILESTONES[idx-1] && getMilestoneStatus(MILESTONES[idx-1]) === 'DONE' ? '#10B981' : '#E2E8F0' }}
                  />
                )}
                <div className="flex gap-4 mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 transition-all"
                    style={{
                      background: isDone ? '#ECFDF5' : isActive ? ms.color + '15' : '#F1F5F9',
                      borderColor: isDone ? '#10B981' : isActive ? ms.color : '#E2E8F0',
                    }}
                  >
                    {isDone ? <CheckCircle size={22} className="text-emerald-500" /> : <MsIcon size={22} style={{ color: isActive ? ms.color : '#94A3B8' }} />}
                  </div>

                  <div className={`flex-1 card p-5 transition-all ${isActive ? 'ring-2' : ''}`} style={{ borderColor: isActive ? ms.color + '40' : undefined, ringColor: isActive ? ms.color + '10' : undefined }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className={`text-base font-semibold ${isDone ? 'text-emerald-600' : 'text-slate-900'}`}>{ms.label}</h3>
                          <StatusBadge status={status} />
                        </div>
                        <p className="text-[13px] text-slate-400 mt-0.5">{ms.description}</p>
                      </div>
                      {isActive && (
                        <span className="px-3 py-1 rounded-full text-white text-[11px] font-bold tracking-wider" style={{ background: ms.color }}>AKTYWNY</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {ms.tasks.map((task, ti) => {
                        const taskDone = isDone || (isActive && ti < 2)
                        const taskActive = isActive && ti === 2
                        return (
                          <div
                            key={ti}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${taskDone ? 'bg-emerald-50/60' : taskActive ? 'bg-blue-50/60' : 'bg-slate-50/50'}`}
                          >
                            {taskDone ? <CheckCircle size={16} className="text-emerald-500" /> : taskActive ? <Circle size={16} className="text-blue-500" strokeWidth={3} /> : <Circle size={16} className="text-slate-300" />}
                            <span className={`text-[13px] ${taskDone ? 'text-emerald-800 line-through' : taskActive ? 'text-blue-800 font-semibold' : 'text-slate-500'}`}>{task}</span>
                          </div>
                        )
                      })}
                    </div>

                    {ms.id === 'm3' && (
                      <div className="mt-3.5 p-3 bg-gradient-to-r from-brand-50 to-indigo-100 rounded-xl">
                        <div className="text-xs font-semibold text-brand-700 flex items-center gap-1.5 mb-1"><TrendingUp size={14} /> Szacowany czas ukończenia etapu</div>
                        <div className="text-[13px] text-brand-700">
                          Na podstawie ML: <strong>~{Math.max(...['ZJAZD','WOD_KAN','ENERGIA'].map(k => predictDays(k, null, historicalData).predicted || 0))} dni</strong> od złożenia ostatniego wniosku
                        </div>
                      </div>
                    )}
                    {ms.id === 'm4' && (
                      <div className="mt-3.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1"><AlertTriangle size={14} /> Wymaga kompletnych odpowiedzi</div>
                        <div className="text-xs text-amber-700">Wniosek o pozwolenie na budowę: 65 dni rozpatrzenie + 14 dni uprawomocnienie.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
