import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ArrowRight, Search, MapPin, Upload, Info, Car, Droplets, Zap, Layers, FileDown, Loader, ExternalLink, CheckCircle, XCircle, HelpCircle, X, Sparkles } from 'lucide-react'
import { Input, Select } from '../components/ui'
import { PROVINCES, PROPERTY_TITLES, ROAD_CLASSES, BUILDING_TYPES } from '../lib/constants'
import { db } from '../lib/database'
import { terytApi } from '../lib/teryt'
import { uldkApi } from '../lib/uldk'
import { mpzpApi, storeMpzpPdf } from '../lib/mpzp'
import { parseLandUseList, CATEGORY_COLORS } from '../lib/land-use-dict'
import toast from 'react-hot-toast'

// ────────────────────────────────────────
// AddressPicker — trzy oddzielne pola
// Miejscowość (TERYT) | Ulica (TERYT) | Nr budynku
// ────────────────────────────────────────
function AddressPicker({ value, onChange }) {
  const set = (field, val) => onChange({ ...value, [field]: val })
  const setMany = (obj) => onChange({ ...value, ...obj })

  // City search state
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState([])
  const [cityLoading, setCityLoading] = useState(false)
  const [cityFocused, setCityFocused] = useState(false)
  const cityDebounce = useRef(null)
  const cityReqId = useRef(0)

  // Street search state
  const [streetQuery, setStreetQuery] = useState('')
  const [streetResults, setStreetResults] = useState([])
  const [streetLoading, setStreetLoading] = useState(false)
  const [streetFocused, setStreetFocused] = useState(false)
  const streetDebounce = useRef(null)
  const streetReqId = useRef(0)

  // House number search state
  const [numberQuery, setNumberQuery] = useState('')
  const [numberResults, setNumberResults] = useState([])
  const [numberLoading, setNumberLoading] = useState(false)
  const [numberFocused, setNumberFocused] = useState(false)
  const numberDebounce = useRef(null)
  const numberReqId = useRef(0)

  const handleCityInput = (e) => {
    const q = e.target.value
    setCityQuery(q)
    if (cityDebounce.current) clearTimeout(cityDebounce.current)
    cityDebounce.current = setTimeout(async () => {
      if (q.length < 2) { setCityResults([]); return }
      setCityLoading(true)
      const reqId = ++cityReqId.current
      const r = await terytApi.searchCity(q)
      if (reqId !== cityReqId.current) return
      setCityResults(r)
      setCityLoading(false)
    }, 300)
  }

  const selectCity = (r) => {
    setMany({
      city: r.city,
      province: r.province,
      postal_code: r.postalCode || '',
      commune: r.commune || '',
      county: r.county || '',
      teryt_id: r.terytId || '',
      street: '',
      number: '',
    })
    setCityQuery('')
    setCityResults([])
    setStreetQuery('')
  }

  const clearCity = () => {
    setMany({ city: '', province: 'mazowieckie', postal_code: '', commune: '', county: '', teryt_id: '', street: '', number: '' })
    setCityQuery('')
    setCityResults([])
    setStreetQuery('')
  }

  const handleStreetInput = (e) => {
    const q = e.target.value
    setStreetQuery(q)
    if (streetDebounce.current) clearTimeout(streetDebounce.current)
    streetDebounce.current = setTimeout(async () => {
      if (q.length < 2 || !value.city) { setStreetResults([]); return }
      setStreetLoading(true)
      const reqId = ++streetReqId.current
      const r = await terytApi.searchStreet(value.teryt_id || '', q, value.city)
      if (reqId !== streetReqId.current) return
      setStreetResults(r)
      setStreetLoading(false)
    }, 300)
  }

  const selectStreet = (r) => {
    setMany({ street: `${r.prefix || 'ul.'} ${r.name}`, number: '' })
    setStreetQuery('')
    setStreetResults([])
    setNumberQuery('')
    setNumberResults([])
  }

  const clearStreet = () => {
    setMany({ street: '', number: '' })
    setStreetQuery('')
    setStreetResults([])
    setNumberQuery('')
    setNumberResults([])
  }

  const handleNumberInput = (e) => {
    const q = e.target.value
    setNumberQuery(q)
    set('number', q)
    if (numberDebounce.current) clearTimeout(numberDebounce.current)
    numberDebounce.current = setTimeout(async () => {
      if (q.length < 1 || !value.city || !value.street) { setNumberResults([]); return }
      setNumberLoading(true)
      const reqId = ++numberReqId.current
      const r = await terytApi.searchHouseNumber(value.city, value.street, q)
      if (reqId !== numberReqId.current) return
      setNumberResults(r)
      setNumberLoading(false)
    }, 400)
  }

  const selectNumber = (n) => {
    set('number', n)
    setNumberQuery(n)
    setNumberResults([])
  }

  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 gap-4">
        {/* ── Miejscowość ── */}
        <div>
          <label className="label-field">Miejscowość *</label>
          <div className="relative">
            {value.city ? (
              <div className="input-field flex items-center justify-between gap-2 pr-2">
                <span className="text-sm text-slate-900 truncate">{value.city}</span>
                <button type="button" onClick={clearCity} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className="input-field pr-8"
                  value={cityQuery}
                  onChange={handleCityInput}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => setTimeout(() => { setCityFocused(false); setCityResults([]) }, 200)}
                  placeholder="Wpisz miejscowość..."
                />
                {cityLoading
                  ? <Loader size={14} className="absolute right-3 top-3 animate-spin text-slate-400" />
                  : <MapPin size={14} className="absolute right-3 top-3 text-slate-300" />
                }
              </div>
            )}
            {cityResults.length > 0 && cityFocused && (
              <div className="absolute top-full left-0 right-0 border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-xl max-h-52 overflow-y-auto bg-white z-50">
                {cityResults.map((r, i) => (
                  <div key={i} onMouseDown={() => selectCity(r)} className="px-3 py-2.5 cursor-pointer border-b border-slate-50 hover:bg-brand-50">
                    <div className="text-[13px] font-semibold text-slate-900">{r.city}</div>
                    <div className="text-[11px] text-slate-400">{r.commune}, pow. {r.county}, {r.province}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {value.city && (
            <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              {[value.commune && `gm. ${value.commune}`, value.county && `pow. ${value.county}`].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* ── Ulica ── */}
        <div>
          <label className="label-field">Ulica</label>
          <div className="relative">
            {value.street ? (
              <div className="input-field flex items-center justify-between gap-2 pr-2">
                <span className="text-sm text-slate-900 truncate">{value.street}</span>
                <button type="button" onClick={clearStreet} className="text-slate-400 hover:text-slate-600 flex-shrink-0"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={`input-field pr-8 ${!value.city ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
                  value={streetQuery}
                  onChange={handleStreetInput}
                  onFocus={() => setStreetFocused(true)}
                  onBlur={() => setTimeout(() => { setStreetFocused(false); setStreetResults([]) }, 200)}
                  placeholder={value.city ? 'Szukaj ulicy...' : 'Najpierw wybierz miasto'}
                  disabled={!value.city}
                />
                {streetLoading && <Loader size={14} className="absolute right-3 top-3 animate-spin text-slate-400" />}
              </div>
            )}
            {streetResults.length > 0 && streetFocused && (
              <div className="absolute top-full left-0 right-0 border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-xl max-h-52 overflow-y-auto bg-white z-50">
                {streetResults.map((r, i) => (
                  <div key={i} onMouseDown={() => selectStreet(r)} className="px-3 py-2.5 cursor-pointer border-b border-slate-50 hover:bg-brand-50 text-[13px]">
                    <span className="text-slate-400 text-[11px]">{r.prefix || 'ul.'} </span>
                    <span className="font-semibold text-slate-900">{r.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Numer budynku ── */}
        <div>
          <label className="label-field">Numer budynku</label>
          <div className="relative">
            <input
              className={`input-field pr-8 ${!value.street ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`}
              value={value.number || numberQuery}
              onChange={handleNumberInput}
              onFocus={() => setNumberFocused(true)}
              onBlur={() => setTimeout(() => { setNumberFocused(false); setNumberResults([]) }, 200)}
              placeholder={value.street ? 'np. 12' : 'Najpierw wybierz ulicę'}
              disabled={!value.street}
            />
            {numberLoading && <Loader size={14} className="absolute right-3 top-3 animate-spin text-slate-400" />}
            {numberResults.length > 0 && numberFocused && (
              <div className="absolute top-full left-0 right-0 border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-xl max-h-40 overflow-y-auto bg-white z-50">
                {numberResults.map((n, i) => (
                  <div key={i} onMouseDown={() => selectNumber(n)} className="px-3 py-2 cursor-pointer border-b border-slate-50 hover:bg-brand-50 text-[13px] font-semibold text-slate-900">
                    {n}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────
// MAIN FORM
// ────────────────────────────────────────
export default function NewProject({ onCreated }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  const [client, setClient] = useState({
    first_name: '', last_name: '', pesel: '', nip: '',
    street: '', number: '', apartment: '', city: '', postal_code: '', province: 'mazowieckie',
    phone: '', email: '',
    commune: '', county: '', teryt_id: '',
  })

  const [plot, setPlot] = useState({
    number: '', area: '', precinct: '', land_register: '', property_title: 'Własność',
    teryt_id: '', voivodeship: '', county_name: '', commune_name: '',
    geometry_wkt: '', centroid: '',
    road_class: 'Gminna', road_name: '', road_plot_number: '',
    building_type: 'Dom jednorodzinny', residents: '4',
    water_demand: '', power_demand: '',
    has_mpzp: null, mpzp_status: '', mpzp_plan_name: '', mpzp_symbol: '',
    mpzp_portal_url: '', mpzp_note: '', mpzp_przeznaczenie: '',
    land_use: '', land_use_details: '',
    purpose: '', building_coverage: '', bio_area: '', intensity: '',
    max_height: '', roof_angle: '', heritage: false, landscape: false,
    parking: '', setbacks: '',
  })

  // Plot search
  const [plotSearch, setPlotSearch] = useState('')
  const [plotResults, setPlotResults] = useState([])
  const [searchingPlot, setSearchingPlot] = useState(false)
  const [checkingMpzp, setCheckingMpzp] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)

  const up = (field, val) => setPlot(p => ({ ...p, [field]: val }))

  // ── ULDK Smart Search ──
  const searchPlotUldk = async () => {
    if (!plotSearch || plotSearch.length < 3) {
      toast.error('Wpisz min. 3 znaki')
      return
    }
    setSearchingPlot(true)
    setPlotResults([])
    try {
      const results = await uldkApi.smartSearch(plotSearch)
      if (results.error) {
        toast.error(results.error)
      } else if (results.data.length === 0) {
        toast('Nie znaleziono', { icon: '🔍' })
      } else {
        setPlotResults(results.data.slice(0, 10))
        toast.success(`Znaleziono ${results.data.length} ${results.data.length === 1 ? 'działkę' : 'działek'}`)
      }
    } catch (e) {
      toast.error('Błąd połączenia z ULDK')
    }
    setSearchingPlot(false)
  }

  const selectPlotResult = (r) => {
    up('number', r.parcelNumber)
    up('precinct', r.region)
    up('teryt_id', r.terytId)
    up('voivodeship', r.voivodeship)
    up('county_name', r.county)
    up('commune_name', r.commune)
    up('geometry_wkt', r.geometry)
    if (r.centroid) up('centroid', JSON.stringify(r.centroid))
    if (r.area) up('area', r.area.toString())
    setPlotResults([])
    const areaStr = r.area ? ` · ${r.area.toLocaleString('pl')} m²` : ''
    toast.success(`dz. ${r.parcelNumber}, obr. ${r.region}${areaStr}`)

    // Auto-fetch parcel info from GUGiK
    if (r.centroid) {
      fetchParcelData(r.centroid, r.commune, {
        number: r.parcelNumber, precinct: r.region, teryt_id: r.terytId,
        voivodeship: r.voivodeship, county_name: r.county, commune_name: r.commune,
        area: r.area?.toString() || '',
      })
    }
  }

  // ── Parcel Info (KIUG + KIMPZP) — can be called with explicit centroid ──
  const fetchParcelData = async (centroid, communeName, plotOverrides) => {
    if (!centroid) { toast.error('Brak współrzędnych'); return }
    setCheckingMpzp(true)
    setAiSummary('')
    try {
      const { uzytki, mpzp } = await mpzpApi.fetchParcelInfo(centroid, communeName || '')

      // Użytki gruntowe
      if (uzytki.available) {
        up('land_use', uzytki.oznaczenia.join(', '))
        up('land_use_details', uzytki.note)
      } else {
        up('land_use_details', uzytki.note)
      }

      // MPZP
      up('mpzp_status', mpzp.status)
      up('mpzp_portal_url', mpzp.portalUrl)
      up('mpzp_plan_name', mpzp.planName || '')
      up('mpzp_symbol', mpzp.planSymbol || '')
      up('mpzp_przeznaczenie', mpzp.przeznaczenie || '')
      up('mpzp_note', mpzp.note || '')
      up('mpzp_act_url', mpzp.actUrl || '')
      if (mpzp.status === 'covered') { up('has_mpzp', true); toast.success('Działka objęta MPZP!') }
      else if (mpzp.status === 'not_covered') { up('has_mpzp', false); toast('Brak MPZP — WZ', { icon: '⚠️' }) }

      // Auto-generate AI summary — enrich with dictionary descriptions
      const landUseStr = uzytki.available ? uzytki.oznaczenia.join(', ') : ''
      const parsed = parseLandUseList(landUseStr)
      const landUseDescriptions = parsed.map(p =>
        `${p.code}: ${p.fullInfo}${p.hint ? ' (' + p.hint + ')' : ''}`
      ).join('\n')

      const summaryData = {
        ...(plotOverrides || {}),
        land_use: landUseStr,
        land_use_parsed: landUseDescriptions,
        kiug_raw: uzytki.raw || '',
        mpzp_status: mpzp.status,
        mpzp_plan_name: mpzp.planName || '',
        mpzp_przeznaczenie: mpzp.przeznaczenie || '',
        mpzp_symbol: mpzp.planSymbol || '',
        kimpzp_raw: mpzp.raw || '',
      }
      generateSummary(summaryData)
    } catch { toast.error('Błąd pobierania danych') }
    setCheckingMpzp(false)
  }

  const checkParcelInfo = async () => {
    let centroid = null
    if (plot.centroid) { try { centroid = JSON.parse(plot.centroid) } catch {} }
    const communeName = plot.commune_name || client.commune || client.city || ''
    if (!centroid) { toast.error('Najpierw wyszukaj działkę w ULDK'); return }
    await fetchParcelData(centroid, communeName, plot)
  }

  // ── AI Summary ──
  const generateSummary = async (data) => {
    setLoadingSummary(true)
    try {
      const { data: result, error } = await (await import('../lib/supabase')).supabase?.functions?.invoke('parcel-summary', {
        body: data,
      }) || {}
      if (result?.summary) {
        setAiSummary(result.summary)
      }
    } catch (err) {
      console.error('AI summary error:', err)
    }
    setLoadingSummary(false)
  }

  const canProceed1 = client.first_name && client.last_name && client.city
  const canSave = plot.number && plot.precinct

  const handleSave = async () => {
    setSaving(true)
    const { data, error } = await db.createProject({ client, plot })
    setSaving(false)
    if (error) { toast.error('Błąd tworzenia projektu'); return }
    toast.success('Projekt utworzony!')
    if (onCreated) await onCreated()
    navigate(`/project/${data.id}`)

    // Auto-download MPZP act PDF in background (non-blocking)
    if (data?.id && plot.mpzp_act_url) {
      const safeName = (plot.mpzp_plan_name || 'uchwala_mpzp')
        .replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60)
      const filename = `${safeName}.pdf`
      storeMpzpPdf(data.id, plot.mpzp_act_url, filename).then(async (url) => {
        if (url) {
          await db.updateProject(data.id, {
            plot: { ...plot, mpzp_file_url: url, mpzp_file_name: filename, mpzp_file_path: `mpzp/${data.id}/${filename}` }
          })
          if (onCreated) await onCreated()
        }
      })
    }
  }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-700"><ChevronLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nowy projekt</h1>
          <p className="text-slate-400 mt-0.5 text-[13px]">Krok {step} z 2</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-7">
        {[{ s: 1, l: 'Dane klienta' }, { s: 2, l: 'Dane działki' }].map(({ s, l }, i) => (
          <div key={s} className="flex items-center" style={{ flex: i < 1 ? 1 : 0 }}>
            <div onClick={() => s < step && setStep(s)} className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all ${s <= step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'} ${s < step ? 'cursor-pointer' : ''}`}>{s}</div>
            <span className={`ml-2 text-[13px] ${s === step ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{l}</span>
            {i < 1 && <div className={`flex-1 h-0.5 mx-4 rounded ${step > s ? 'bg-brand-600' : 'bg-slate-200'} transition-colors`} />}
          </div>
        ))}
      </div>

      <div className="card p-8">
        {/* ═══ STEP 1: CLIENT ═══ */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-slate-900 mb-5">Dane klienta (inwestora)</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Imię *" value={client.first_name} onChange={e => setClient(c => ({...c, first_name: e.target.value}))} placeholder="Jan" />
              <Input label="Nazwisko *" value={client.last_name} onChange={e => setClient(c => ({...c, last_name: e.target.value}))} placeholder="Kowalski" />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="PESEL" value={client.pesel} onChange={e => setClient(c => ({...c, pesel: e.target.value}))} placeholder="85010112345" />
              <Input label="NIP (firma)" value={client.nip} onChange={e => setClient(c => ({...c, nip: e.target.value}))} placeholder="opcjonalnie" />
            </div>

            {/* Adres zamieszkania: Miejscowość | Ulica | Nr budynku */}
            <AddressPicker value={client} onChange={setClient} />

            <div className="grid grid-cols-3 gap-4 mb-4">
              <Input label="Nr mieszkania (opcjonalnie)" value={client.apartment} onChange={e => setClient(c => ({...c, apartment: e.target.value}))} placeholder="np. 12A" />
              <Input label="Telefon" value={client.phone} onChange={e => setClient(c => ({...c, phone: e.target.value}))} placeholder="600-000-000" />
              <Input label="Email" value={client.email} onChange={e => setClient(c => ({...c, email: e.target.value}))} placeholder="email@domena.pl" />
            </div>

            <div className="flex justify-end mt-6 gap-3">
              <button onClick={() => navigate('/')} className="btn-secondary">Anuluj</button>
              <button onClick={() => setStep(2)} disabled={!canProceed1} className="btn-primary flex items-center gap-1.5">Dalej <ArrowRight size={16} /></button>
            </div>
          </>
        )}

        {/* ═══ STEP 2: PLOT ═══ */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Dane działki</h2>
            <p className="text-slate-400 text-[13px] mb-5">Wyszukaj w ULDK lub wpisz ręcznie. Powierzchnia z geometrii.</p>

            {/* ULDK Smart Search */}
            <div className="mb-5">
              <label className="label-field">Wyszukaj działkę (ULDK / GUGiK)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input className="input-field pl-9" value={plotSearch} onChange={e => setPlotSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPlotUldk()} placeholder="TERYT ID lub obręb + numer, np: 141201_1.0001.6509 lub Piaseczno 123/4" />
                </div>
                <button onClick={searchPlotUldk} disabled={searchingPlot} className="btn-primary whitespace-nowrap flex items-center gap-1.5">
                  {searchingPlot ? <Loader size={14} className="animate-spin" /> : <MapPin size={14} />}
                  {searchingPlot ? 'Szukam...' : 'Szukaj'}
                </button>
              </div>

              {plotResults.length > 0 && (
                <div className="border border-slate-200 rounded-xl mt-2 overflow-hidden shadow-xl max-h-72 overflow-y-auto bg-white">
                  {plotResults.map((r, i) => (
                    <div key={i} onClick={() => selectPlotResult(r)} className="px-4 py-3 cursor-pointer border-b border-slate-50 text-[13px] flex items-center gap-3 hover:bg-brand-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <MapPin size={14} className="text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900">dz. {r.parcelNumber} — obr. {r.region}</div>
                        <div className="text-[11px] text-slate-400 truncate">{r.commune}, pow. {r.county}, woj. {r.voivodeship}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {r.area && <div className="text-xs font-bold text-brand-600">{r.area.toLocaleString('pl')} m²</div>}
                        <div className="text-[10px] text-slate-400 font-mono">{r.terytId}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <Info size={11} /> ULDK/GUGiK — darmowe API. Wpisz identyfikator TERYT lub „obręb numer".
              </div>
            </div>

            {/* Plot fields */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Input label="Numer działki *" value={plot.number} onChange={e => up('number', e.target.value)} placeholder="123/4" />
              <Input label="Obręb *" value={plot.precinct} onChange={e => up('precinct', e.target.value)} placeholder="Piaseczno" />
              <Input label="Powierzchnia (m²)" value={plot.area} onChange={e => up('area', e.target.value)} placeholder="auto" />
              <Input label="ID działki (ULDK)" value={plot.teryt_id} onChange={e => up('teryt_id', e.target.value)} placeholder="auto z wyszukiwarki" />
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Input label="Województwo" value={plot.voivodeship} onChange={e => up('voivodeship', e.target.value)} />
              <Input label="Powiat" value={plot.county_name} onChange={e => up('county_name', e.target.value)} />
              <Input label="Gmina" value={plot.commune_name} onChange={e => up('commune_name', e.target.value)} />
              <Input label="Użytki gruntowe" value={plot.land_use} onChange={e => up('land_use', e.target.value)} placeholder="auto (KIUG)" />
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Input label="Nr KW" value={plot.land_register} onChange={e => up('land_register', e.target.value)} placeholder="WA1I/..." />
              <Select label="Tytuł prawny" value={plot.property_title} onChange={e => up('property_title', e.target.value)} options={PROPERTY_TITLES} />
              <Select label="Typ budynku" value={plot.building_type} onChange={e => up('building_type', e.target.value)} options={BUILDING_TYPES} />
              <Input label="Liczba mieszkańców" type="number" value={plot.residents} onChange={e => up('residents', e.target.value)} />
            </div>

            {/* Road */}
            <h3 className="text-sm font-semibold text-slate-900 mt-6 mb-3 flex items-center gap-2"><Car size={16} className="text-orange-500" /> Dane drogi (zjazd)</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Select label="Klasa drogi" value={plot.road_class} onChange={e => up('road_class', e.target.value)} options={ROAD_CLASSES} />
              <Input label="Nazwa drogi" value={plot.road_name} onChange={e => up('road_name', e.target.value)} placeholder="ul. Lipowa" />
              <Input label="Nr działki drogowej" value={plot.road_plot_number} onChange={e => up('road_plot_number', e.target.value)} placeholder="300/1" />
            </div>

            {/* Media */}
            <h3 className="text-sm font-semibold text-slate-900 mt-6 mb-3 flex items-center gap-2"><Droplets size={16} className="text-blue-500" /><Zap size={16} className="text-amber-500" /> Media</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Qdśr wody (m³/d)" value={plot.water_demand} onChange={e => up('water_demand', e.target.value)} placeholder="0.8" />
              <Input label="Moc przył. (kW)" value={plot.power_demand} onChange={e => up('power_demand', e.target.value)} placeholder="14" />
            </div>

            {/* ══ UŻYTKI GRUNTOWE + MPZP — one button queries both ══ */}
            <h3 className="text-sm font-semibold text-slate-900 mt-6 mb-3 flex items-center gap-2"><Layers size={16} className="text-brand-500" /> Użytki gruntowe i MPZP</h3>
            <div className="flex gap-3 mb-4 items-center flex-wrap">
              <button onClick={checkParcelInfo} disabled={checkingMpzp} className="btn-primary text-xs flex items-center gap-1.5">
                {checkingMpzp ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
                {checkingMpzp ? 'Pobieram dane...' : 'Pobierz dane z GUGiK'}
              </button>
              <button onClick={() => up('has_mpzp', true)} className={`px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all ${plot.has_mpzp === true ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-400'}`}>Jest MPZP</button>
              <button onClick={() => up('has_mpzp', false)} className={`px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all ${plot.has_mpzp === false ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 text-slate-400'}`}>Brak (WZ)</button>
            </div>
            <p className="text-[11px] text-slate-400 -mt-2 mb-4 flex items-center gap-1">
              <Info size={11} /> Pobiera użytki gruntowe (KIUG) i status MPZP (KIMPZP) z ogólnopolskich WMS GUGiK. Wymaga deploy Edge Function.
            </p>

            {/* Land use result — parsed with dictionary */}
            {plot.land_use && (() => {
              const parsed = parseLandUseList(plot.land_use)
              return parsed.length > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Użytki gruntowe na działce</div>
                  {parsed.map((p, i) => {
                    const cat = CATEGORY_COLORS[p.category] || CATEGORY_COLORS['rolne/pozostałe']
                    return (
                      <div key={i} className={`rounded-xl px-4 py-3 ${cat.bg} border ${cat.border} flex items-start gap-2.5`}>
                        <span className="text-lg mt-0.5">{cat.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${cat.text}`}>{p.code}</span>
                            {p.useType && <span className="text-xs text-slate-600">— {p.useType.official}</span>}
                            {p.soilClassStr && <span className="text-[11px] bg-white/70 px-1.5 py-0.5 rounded font-mono">kl. {p.soilClassStr}</span>}
                          </div>
                          {p.useType && <div className="text-[12px] text-slate-500 mt-0.5">{p.useType.common}</div>}
                          {p.hint && <div className="text-[11px] text-slate-400 mt-1 italic">{p.hint}</div>}
                          {p.soilClass && <div className="text-[11px] text-slate-500 mt-0.5">🧪 {p.soilClass.description}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* MPZP status */}
            {plot.mpzp_status && (
              <div className={`rounded-xl px-4 py-3 mb-4 flex items-start gap-2.5 ${plot.mpzp_status === 'covered' ? 'bg-emerald-50 border border-emerald-200' : plot.mpzp_status === 'not_covered' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                {plot.mpzp_status === 'covered' ? <CheckCircle size={18} className="text-emerald-500 mt-0.5" /> : plot.mpzp_status === 'not_covered' ? <XCircle size={18} className="text-red-500 mt-0.5" /> : <HelpCircle size={18} className="text-amber-500 mt-0.5" />}
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${plot.mpzp_status === 'covered' ? 'text-emerald-800' : plot.mpzp_status === 'not_covered' ? 'text-red-800' : 'text-amber-800'}`}>
                    {plot.mpzp_status === 'covered' ? 'Teren objęty MPZP' : plot.mpzp_status === 'not_covered' ? 'Brak MPZP — wymagane WZ' : 'Status MPZP nieznany'}
                  </div>
                  {plot.mpzp_plan_name && <div className="text-xs text-slate-600 mt-0.5">Plan: {plot.mpzp_plan_name}</div>}
                  {plot.mpzp_przeznaczenie && <div className="text-xs text-slate-600">Przeznaczenie: {plot.mpzp_przeznaczenie}</div>}
                  {plot.mpzp_note && <div className="text-xs text-slate-500 mt-1">{plot.mpzp_note}</div>}
                </div>
                {plot.mpzp_portal_url && (
                  <a href={plot.mpzp_portal_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-600 bg-white px-3 py-1.5 rounded-lg border border-brand-200 flex items-center gap-1 hover:bg-brand-50 flex-shrink-0">
                    <ExternalLink size={12} /> Geoportal
                  </a>
                )}
              </div>
            )}

            {/* MPZP details */}
            {plot.has_mpzp === true && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Input label="Przeznaczenie" value={plot.purpose} onChange={e => up('purpose', e.target.value)} placeholder="MN — jednorodzinna" />
                  <Input label="Max zabudowy (%)" value={plot.building_coverage} onChange={e => up('building_coverage', e.target.value)} placeholder="30" />
                  <Input label="Min biol. czynna (%)" value={plot.bio_area} onChange={e => up('bio_area', e.target.value)} placeholder="60" />
                  <Input label="Intensywność" value={plot.intensity} onChange={e => up('intensity', e.target.value)} placeholder="0.4-0.8" />
                  <Input label="Max wysokość (m)" value={plot.max_height} onChange={e => up('max_height', e.target.value)} placeholder="10" />
                  <Input label="Kąt dachu (°)" value={plot.roof_angle} onChange={e => up('roof_angle', e.target.value)} placeholder="30-45" />
                  <Input label="Parking (miejsca)" value={plot.parking} onChange={e => up('parking', e.target.value)} placeholder="2" />
                  <Input label="Odległości od granic" value={plot.setbacks} onChange={e => up('setbacks', e.target.value)} placeholder="4m/3m" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Rejestr zabytków" value={plot.heritage ? 'Tak' : 'Nie'} onChange={e => up('heritage', e.target.value === 'Tak')} options={['Nie', 'Tak']} />
                  <Select label="Ochrona krajobrazu" value={plot.landscape ? 'Tak' : 'Nie'} onChange={e => up('landscape', e.target.value === 'Tak')} options={['Nie', 'Tak']} />
                </div>
              </>
            )}

            {/* ══ SEKCJA 2: AI PODSUMOWANIE DZIAŁKI ══ */}
            {(aiSummary || loadingSummary) && (
              <div className="mt-6 mb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-violet-500" /> Podsumowanie AI
                </h3>
                <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 px-5 py-4">
                  {loadingSummary ? (
                    <div className="flex items-center gap-2 text-violet-600 text-sm">
                      <Loader size={14} className="animate-spin" />
                      Analizuję dane działki...
                    </div>
                  ) : (
                    <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{aiSummary}</div>
                  )}
                </div>
                {!loadingSummary && aiSummary && (
                  <button onClick={() => generateSummary(plot)} className="text-[11px] text-violet-500 hover:text-violet-700 mt-2 flex items-center gap-1">
                    <Sparkles size={10} /> Wygeneruj ponownie
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-between mt-7">
              <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1.5"><ChevronLeft size={16} /> Wstecz</button>
              <button onClick={handleSave} disabled={!canSave || saving} className="btn-primary">{saving ? 'Tworzę...' : 'Utwórz projekt'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
