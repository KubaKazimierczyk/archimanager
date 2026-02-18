/**
 * ULDK v3 — Usługa Lokalizacji Działek Katastralnych (GUGiK)
 * https://uldk.gugik.gov.pl/opis.html
 * 
 * Response formats differ by method:
 * 
 * GetParcelById / GetParcelByXY:
 *   Line 1: status (0 = found, -1 = not found, other negative = error)
 *   Line 2: data (pipe-separated fields)
 * 
 * GetParcelByIdOrNr:
 *   Line 1: count of results
 *   Line 2+: data lines (pipe-separated)
 */

const ULDK = 'https://uldk.gugik.gov.pl/'
const FIELDS = 'teryt,voivodeship,county,commune,region,parcel,geom_wkt'

// ══════════════════════════════════════════════════
// TERYT ID patterns:
//   141201_1.0001.6509        (standard)
//   141201_1.0001.AR_2.6509   (with arkusz)
//   141201_1.0001.123/4       (with slash)
// ══════════════════════════════════════════════════
const TERYT_RE = /^\d{6}_\d\.\d{4}\..+$/

/**
 * Universal smart search. Accepts any format:
 * - TERYT ID: "141201_1.0001.6509"
 * - Obręb + numer: "Piaseczno 123/4"  
 * - Just try both methods as fallback
 */
export async function smartSearch(input) {
  const q = (input || '').trim()
  if (q.length < 2) return { data: [], error: 'Min. 2 znaki' }

  // 1. TERYT ID → GetParcelById (returns exactly 0 or 1 result)
  if (TERYT_RE.test(q)) {
    console.log('[ULDK] TERYT ID detected:', q)
    const r = await callById(q)
    if (r.data.length > 0) return r
    // If not found, maybe user copied it wrong — try IdOrNr as fallback
    console.log('[ULDK] GetParcelById failed, fallback to GetParcelByIdOrNr')
    return callByIdOrNr(q)
  }

  // 2. Everything else → GetParcelByIdOrNr (handles "obręb numer" and partial IDs)
  console.log('[ULDK] Free text search:', q)
  return callByIdOrNr(q)
}

// Aliases for explicit calls
export const searchParcel = (district, number) => callByIdOrNr(`${district} ${number}`)
export const searchParcelById = (id) => callById(id)
export const getParcelAtPoint = (lat, lng) => callByXY(lat, lng)

// ══════════════════════════════════════════════════
// API METHODS
// ══════════════════════════════════════════════════

async function callById(terytId) {
  const url = `${ULDK}?request=GetParcelById&id=${enc(terytId)}&result=${FIELDS}&srid=4326`
  const text = await fetchText(url)
  if (text === null) return { data: [], error: 'Błąd połączenia z ULDK' }
  return parseStatusResponse(text)
}

async function callByIdOrNr(query) {
  const url = `${ULDK}?request=GetParcelByIdOrNr&id=${enc(query)}&result=${FIELDS}&srid=4326`
  const text = await fetchText(url)
  if (text === null) return { data: [], error: 'Błąd połączenia z ULDK' }
  return parseCountResponse(text)
}

async function callByXY(lat, lng) {
  const url = `${ULDK}?request=GetParcelByXY&xy=${lng},${lat},4326&result=${FIELDS}&srid=4326`
  const text = await fetchText(url)
  if (text === null) return { data: [], error: 'Błąd połączenia z ULDK' }
  return parseStatusResponse(text)
}

// ══════════════════════════════════════════════════
// PARSERS (two different response formats)
// ══════════════════════════════════════════════════

/**
 * GetParcelById / GetParcelByXY format:
 * Line 1: status code (0 = OK, negative = error)
 * Line 2: pipe-separated data
 */
function parseStatusResponse(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { data: [], error: 'Pusta odpowiedź' }

  const status = lines[0]

  // Error status
  if (status.startsWith('-1')) return { data: [], error: 'Działka nie znaleziona' }
  if (status.startsWith('-')) return { data: [], error: `Błąd ULDK: ${status}` }

  // Status "0" means success — data is on line 2
  // But sometimes the API returns data directly without status line
  if (status === '0' && lines.length >= 2 && lines[1].includes('|')) {
    const parsed = parseLine(lines[1])
    return parsed ? { data: [parsed], error: null } : { data: [], error: 'Błąd parsowania' }
  }

  // Maybe data came directly (no status line)
  if (status.includes('|')) {
    const parsed = parseLine(status)
    return parsed ? { data: [parsed], error: null } : { data: [], error: 'Błąd parsowania' }
  }

  return { data: [], error: `Nieoczekiwana odpowiedź: ${status.substring(0, 80)}` }
}

/**
 * GetParcelByIdOrNr format:
 * Line 1: count of results (integer)
 * Lines 2+: pipe-separated data
 */
function parseCountResponse(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { data: [], error: 'Pusta odpowiedź' }

  const first = lines[0]

  // Error codes
  if (first.startsWith('-1')) return { data: [], error: 'Działka nie znaleziona' }
  if (first.startsWith('-')) return { data: [], error: `Błąd ULDK: ${first}` }

  // First line should be count
  const count = parseInt(first)
  
  if (!isNaN(count) && count >= 0 && !first.includes('|')) {
    if (count === 0) return { data: [], error: 'Działka nie znaleziona' }
    // Parse subsequent data lines
    const results = []
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].includes('|')) {
        const p = parseLine(lines[i])
        if (p) results.push(p)
      }
    }
    return { data: results, error: results.length ? null : 'Brak danych w odpowiedzi' }
  }

  // Maybe data came without count (edge case)
  if (first.includes('|')) {
    const results = lines.filter(l => l.includes('|')).map(parseLine).filter(Boolean)
    return { data: results, error: results.length ? null : 'Błąd parsowania' }
  }

  return { data: [], error: `Nieoczekiwana odpowiedź: ${first.substring(0, 80)}` }
}

// ══════════════════════════════════════════════════
// LINE PARSER
// ══════════════════════════════════════════════════

function parseLine(line) {
  // Fields: teryt|voivodeship|county|commune|region|parcel|geom_wkt
  const idx1 = nthPipe(line, 6)
  if (idx1 === -1) return null

  const meta = line.substring(0, idx1).split('|')
  const geomRaw = line.substring(idx1 + 1).trim()
  const geometry = geomRaw.replace(/^SRID=\d+;/i, '')

  const terytId = (meta[0] || '').trim()
  const voivodeship = (meta[1] || '').trim()
  const county = (meta[2] || '').trim()
  const commune = (meta[3] || '').trim()
  const region = (meta[4] || '').trim()
  const parcelNumber = (meta[5] || '').trim()

  if (!terytId && !parcelNumber) return null

  return {
    terytId, voivodeship, county, commune, region, parcelNumber,
    geometry,
    centroid: centroid(geometry),
    area: polyArea(geometry),
  }
}

/** Find the position of the Nth pipe character */
function nthPipe(str, n) {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '|') {
      count++
      if (count === n) return i
    }
  }
  return -1
}

// ══════════════════════════════════════════════════
// GEOMETRY UTILS
// ══════════════════════════════════════════════════

function coords(wkt) {
  if (!wkt) return []
  // Handle MULTIPOLYGON and POLYGON
  const match = wkt.match(/\(\(([^)]+)\)\)/)
  if (!match) return []
  return match[1].split(',').map(p => {
    const [lng, lat] = p.trim().split(/\s+/).map(Number)
    return (isNaN(lat) || isNaN(lng)) ? null : { lat, lng }
  }).filter(Boolean)
}

function centroid(wkt) {
  const c = coords(wkt)
  if (!c.length) return null
  return {
    lat: c.reduce((s, p) => s + p.lat, 0) / c.length,
    lng: c.reduce((s, p) => s + p.lng, 0) / c.length,
  }
}

function polyArea(wkt) {
  const c = coords(wkt)
  if (c.length < 3) return null
  const rLat = c[0].lat
  const mLat = 111320
  const mLng = 111320 * Math.cos(rLat * Math.PI / 180)
  const m = c.map(p => ({ x: (p.lng - c[0].lng) * mLng, y: (p.lat - c[0].lat) * mLat }))
  let a = 0
  for (let i = 0; i < m.length; i++) {
    const j = (i + 1) % m.length
    a += m[i].x * m[j].y - m[j].x * m[i].y
  }
  return Math.round(Math.abs(a) / 2)
}

// ══════════════════════════════════════════════════
// FETCH HELPER
// ══════════════════════════════════════════════════

function enc(s) { return encodeURIComponent(s) }

async function fetchText(url) {
  try {
    console.log('[ULDK]', url)
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const t = await r.text()
    console.log('[ULDK] →', t.substring(0, 150).replace(/\n/g, '\\n'))
    return t
  } catch (e) {
    console.error('[ULDK] fetch error:', e.message)
    return null
  }
}

export const uldkApi = { smartSearch, searchParcel, searchParcelById, getParcelAtPoint }
