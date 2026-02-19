// supabase/functions/parcel-info/index.ts
// Deploy: supabase functions deploy parcel-info
//
// Queries two national GUGiK WMS services for a given point:
//   1. KIUG — land use / soil class
//   2. KIMPZP — zoning plan (MPZP)
//
// Handles 7+ different WMS response formats used by Polish communes.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const KIUG_URL = "https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaUzytkowGruntowych"
const KIMPZP_URL = "https://mapy.geoportal.gov.pl/wss/ext/KrajowaIntegracjaMiejscowychPlanowZagospodarowaniaPrzestrzennego"

// ── WMS GetFeatureInfo URL builder ──

function buildGFI(baseUrl: string, layers: string, lat: number, lng: number, format: string, version: string = "1.1.1", size: number = 11): string {
  const d = 0.0005 // ~55m bbox
  const half = Math.floor(size / 2)

  if (version === "1.3.0") {
    const bbox = `${lat - d},${lng - d},${lat + d},${lng + d}`
    return `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo` +
      `&LAYERS=${layers}&QUERY_LAYERS=${layers}` +
      `&CRS=EPSG:4326&BBOX=${bbox}` +
      `&WIDTH=${size}&HEIGHT=${size}&I=${half}&J=${half}` +
      `&INFO_FORMAT=${encodeURIComponent(format)}&FEATURE_COUNT=20`
  }

  // WMS 1.1.1: BBOX is minX,minY,maxX,maxY (lng,lat,lng,lat)
  const minX = lng - d, minY = lat - d, maxX = lng + d, maxY = lat + d
  const bbox = `${minX},${minY},${maxX},${maxY}`
  return `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${layers}&QUERY_LAYERS=${layers}` +
    `&SRS=EPSG:4326&BBOX=${bbox}` +
    `&WIDTH=${size}&HEIGHT=${size}&X=${half}&Y=${half}` +
    `&INFO_FORMAT=${encodeURIComponent(format)}&FEATURE_COUNT=20`
}

async function fetchWMS(url: string, label: string): Promise<string> {
  try {
    console.log(`[${label}] ${url.substring(0, 200)}...`)
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const text = await resp.text()
    console.log(`[${label}] ${resp.status} — ${text.length} chars`)
    return text
  } catch (err) {
    console.log(`[${label}] Error: ${err.message}`)
    return ""
  }
}

// ── KIUG: Land use ──

async function queryKIUG(lat: number, lng: number) {
  const result = { available: false, oznaczenia: [] as string[], raw: "" }

  const layers = "dzialki,uzytki,klasouzytki"
  let text = await fetchWMS(buildGFI(KIUG_URL, layers, lat, lng, "text/html"), "KIUG-html")

  if (!text || text.length < 20) {
    text = await fetchWMS(buildGFI(KIUG_URL, layers, lat, lng, "text/xml"), "KIUG-xml")
  }

  if (!text || text.length < 20) {
    text = await fetchWMS(buildGFI(KIUG_URL, layers, lat, lng, "text/html", "1.3.0"), "KIUG-1.3")
  }

  result.raw = text.substring(0, 800)

  if (!text || text.length < 20) return result

  const codes: string[] = []

  for (const m of text.matchAll(/OZNACZENIE[^>]*>\s*([^<\n|]+)/gi)) {
    const val = m[1].trim()
    if (val && val.length < 20 && !/OZNACZENIE/i.test(val)) codes.push(val)
  }

  if (codes.length === 0) {
    for (const m of text.matchAll(/\b(R|Ps|Ł|S|Br|Bi|Ba|Bz|B|Bp|Ls|Lz|N|W|dr|Tk|Ti|Tp)(I{1,3}|IV[ab]?|V|VI(?:z)?)\b/g)) {
      if (!codes.includes(m[0])) codes.push(m[0])
    }
  }

  if (codes.length === 0) {
    const pipeMatch = text.match(/\|\s*((?:[A-ZŁ][a-z]?(?:I{1,3}|IV[ab]?|V|VI)?(?:,\s*)?)+)\s*\|/)
    if (pipeMatch) {
      for (const c of pipeMatch[1].split(',')) {
        const trimmed = c.trim()
        if (trimmed && /^[A-ZŁ]/.test(trimmed)) codes.push(trimmed)
      }
    }
  }

  result.available = codes.length > 0
  result.oznaczenia = [...new Set(codes)]
  return result
}

// ════════════════════════════════════════════════════════════
// KIMPZP: Zoning plan — multi-format parser
// ════════════════════════════════════════════════════════════

type MpzpResult = {
  status: string
  planName: string | null
  symbol: string | null
  przeznaczenie: string | null
  actUrl: string | null
  raw: string
}

// ── Helper: parse an HTML table into key→value map (first data row) ──
function parseHtmlTable(tableHtml: string): Record<string, string> {
  const data: Record<string, string> = {}
  const tRows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (tRows.length < 2) return data

  // First row: <th> headers
  const headers = [...tRows[0][1].matchAll(/<th[^>]*>([^<]*)<\/th>/gi)]
    .map(m => m[1].trim().toLowerCase())
  if (headers.length === 0) return data

  // Find first data row with <td>
  const dataRow = tRows.find((r, i) => i > 0 && /<td/i.test(r[1]))
  if (!dataRow) return data

  const values = [...dataRow[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim())

  headers.forEach((h, i) => {
    if (values[i] && values[i] !== 'null' && values[i] !== '' && values[i] !== 'NULL') {
      data[h] = values[i]
    }
  })
  return data
}

// ── Format 1: XML ROWSET (Warszawa, Oracle-based WMS) ──
// <GetFeatureInfo_Result><ROWSET name="MPZP_PRZEZNACZENIE_TERENU"><ROW>
//   <FUN_SYMB>1.KDZ</FUN_SYMB><FUN_NAZWA>droga zbiorcza</FUN_NAZWA>
//   <NAZWA_PLAN>otoczenie PKiN</NAZWA_PLAN>
// </ROW></ROWSET></GetFeatureInfo_Result>
function parseRowset(text: string): Partial<MpzpResult> {
  const rows: Record<string, string>[] = []
  for (const m of text.matchAll(/<ROW[^>]*>([\s\S]*?)<\/ROW>/gi)) {
    const row: Record<string, string> = {}
    for (const f of m[1].matchAll(/<(\w+)>\s*([^<]+?)\s*<\/\1>/g)) {
      if (f[2].trim() && f[2].trim() !== 'null') row[f[1].toLowerCase()] = f[2].trim()
    }
    if (Object.keys(row).length > 0) rows.push(row)
  }
  if (rows.length === 0) return { status: "not_covered" }

  const r = rows[0]
  return {
    status: "covered",
    symbol: r.fun_symb || r.symbol || null,
    przeznaczenie: r.fun_nazwa || r.przeznaczenie || null,
    planName: r.nazwa_plan || r.nazwa || null,
  }
}

// ── Format 2: ESRI ArcGIS HTML (Kraków, Wrocław, Opole, Katowice, Poznań) ──
// <!DOCTYPE html PUBLIC ... ><html xmlns:esri_wms=...>
// <h5>FeatureInfoCollection - layer name: '...'</h5>
// <table><tr><th>Uchwalenie</th><th>Oznaczenie</th><th>Nazwa MPZP</th>...</tr>
// <tr><td>XII/131/11</td><td>KP.1</td><td>STARE MIASTO</td>...</tr>
function parseEsriHtml(text: string): Partial<MpzpResult> {
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi
  for (const tableM of text.matchAll(tableRe)) {
    const data = parseHtmlTable(tableM[1])
    if (Object.keys(data).length === 0) continue

    // Field mapping for different ESRI layer schemas
    const symbol = data['oznaczenie'] || data['nr planu'] || data['fun_symb'] || null
    const planName = data['nazwa mpzp'] || data['nazwa planu'] || data['tytul'] || data['plan'] || null
    const uchwala = data['uchwalenie'] || data['nr uchwały'] || data['pla_nr'] || null
    const dataDate = data['data uchwalenia'] || data['data_uchwalenia'] || data['obowiazujeod'] || null
    const przeznaczenie = data['opis_oznac'] || data['rodzaj oznaczenia'] || data['przeznaczenie'] || null
    const link = data['www'] || data['link'] || data['lacze'] || null

    if (planName || symbol || uchwala) {
      const name = uchwala
        ? `Uchwała ${uchwala}${dataDate ? ' z dnia ' + dataDate : ''}`
        : (planName || null)
      return { status: "covered", planName: name, symbol, przeznaczenie }
    }
  }
  return { status: "unknown" }
}

// ── Format 3: GeoServer HTML ──
// <title>Geoserver GetFeatureInfo output</title>
// <table class="featureInfo">
//   <caption>app.AktPlanowaniaPrzestrzennego.MPZP</caption>
//   <tr><th>tytul</th><th>dokumentuchwalajacy</th><th>obowiazujeod</th>...</tr>
//   <tr><td>Miejscowy plan ...</td><td>Uchwała nr 459/2004 ...</td>...</tr>
// Sub-variant (Szczecin): <caption>mpzp_obo_gra_02</caption>
//   <tr><th>nazwa_plan</th><th>nr_uch_uch</th><th>data_uch_u</th><th>LINK2</th>...</tr>
function parseGeoserver(text: string): Partial<MpzpResult> {
  const tableRe = /<table[^>]*class="featureInfo"[^>]*>([\s\S]*?)<\/table>/gi
  for (const tableM of text.matchAll(tableRe)) {
    const tableHtml = tableM[1]
    const tRows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    if (tRows.length < 1) continue

    const headers = [...tRows[0][1].matchAll(/<th[^>]*>([^<]*)<\/th>/gi)]
      .map(m => m[1].trim().toLowerCase())
    if (headers.length === 0) continue

    // No data rows = no MPZP at this point
    const hasData = tRows.some((r, i) => i > 0 && /<td/i.test(r[1]))
    if (!hasData) return { status: "not_covered" }

    const data = parseHtmlTable(tableHtml)

    // Schema: app.AktPlanowaniaPrzestrzennego.MPZP (Radom, Płock, Bydgoszcz, Zielona Góra...)
    const tytul = data['tytul'] || data['name'] || null
    const dokument = data['dokumentuchwalajacy'] || null // full resolution text
    const nrUch = data['nr_uch_uch'] || null
    const dataDate = data['obowiazujeod'] || data['data_obow'] || data['data_uch_u'] || null

    // Schema: mpzp_obo_gra_02 (Szczecin)
    const nazwaPlan = data['nazwa_plan'] || null

    // Schema: app.RysunkiAktuPlanowania.MPZP (Elbląg) with rich zone data
    const nazwaplanu = data['nazwa_planu'] || null
    const nrUchwaly = data['numer_uchwaly'] || null
    const dataUchwBog = data['data_uchwalenia'] || null
    const symbolWPlanie = data['symbol_w_planie'] || null
    const przeznaczenieBog = data['przeznaczenie'] || null
    const funkcja = data['funkcja_podstawowa_opis'] || data['funkcja_podstawowa'] || null

    // Build plan name — prefer rich data
    let planName: string | null = null
    if (dokument) {
      planName = dokument.substring(0, 120) // "Uchwała nr 459/2004 Rady Miejskiej w Radomiu..."
    } else if (nrUchwaly) {
      planName = `Uchwała ${nrUchwaly}${dataUchwBog ? ' z dnia ' + dataUchwBog : ''}`
    } else if (nrUch) {
      planName = `Uchwała ${nrUch}${dataDate ? ' z dnia ' + dataDate : ''}`
    } else {
      planName = nazwaplanu || nazwaPlan || tytul || null
    }

    const symbol = symbolWPlanie || null
    const przeznaczenie = przeznaczenieBog || funkcja || null

    if (planName || tytul || nazwaPlan || nazwaplanu) {
      return { status: "covered", planName, symbol, przeznaczenie }
    }
  }
  return { status: "unknown" }
}

// ── Format 4: MapServer GFI HTML (Sopot, Gorzów, Zamość, Rzeszów) ──
// <HEAD><TITLE> GetFeatureInfo results </TITLE>
// <TR><TH>Layer</TH><TD>mpzp_meta</TD></TR>
// <TR><TH>nazwa</TH><TD>plan name</TD></TR>
// <TR><TH>numer_uchwaly</TH><TD>XI/162/2007</TD></TR>
// <TR><TH>status</TH><TD>obowiazujacy</TD></TR>
function parseMapServerGfi(text: string): Partial<MpzpResult> {
  const data: Record<string, string> = {}
  for (const m of text.matchAll(/<TH[^>]*>\s*([^<]+?)\s*<\/TH>\s*<TD[^>]*>([\s\S]*?)<\/TD>/gi)) {
    const key = m[1].trim().toLowerCase()
    const val = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()
    if (key && val && val.toLowerCase() !== 'null') data[key] = val
  }

  // Only "Layer" key = just metadata header, no actual features
  const featureKeys = Object.keys(data).filter(k => k !== 'layer' && k !== 'feature')
  if (featureKeys.length === 0) return { status: "not_covered" }

  const nazwa = data['nazwa'] || data['name'] || null
  const nrUchwaly = data['numer_uchwaly'] || data['nr_uchwaly'] || null
  const dataDate = data['data'] || null
  const status = data['status'] || ''
  const isActive = !status || /obowiazujacy|obowiązujący|aktywny/i.test(status)

  if (!isActive) return { status: "not_covered" }
  if (!nazwa && !nrUchwaly) return { status: "unknown" }

  return {
    status: "covered",
    planName: nrUchwaly
      ? `Uchwała ${nrUchwaly}${dataDate ? ' z dnia ' + dataDate : ''}`
      : nazwa,
    symbol: null,
    przeznaczenie: null,
  }
}

// ── Format 5: MapProxy simple HTML (Legnica) ──
// <title>Information</title>
// <div class='layer-title'>Plany wektorowe-Strefy</div>
// <th>numer</th><td>XLII/440/06</td>
// <th>symbol</th><td>U4.5</td>
function parseLegnicaHtml(text: string): Partial<MpzpResult> {
  const data: Record<string, string> = {}
  for (const m of text.matchAll(/<th[^>]*>\s*([^<]+?)\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const key = m[1].trim().toLowerCase()
    const val = m[2].replace(/<[^>]+>/g, '').trim()
    if (key && val && val.toLowerCase() !== 'null') data[key] = val
  }

  const symbol = data['symbol'] || null
  const numer = data['numer'] || null
  const przeznaczenie = data['przeznaczenie'] && data['przeznaczenie'] !== 'N'
    ? data['przeznaczenie'] : null

  if (!symbol && !numer) return { status: "not_covered" }

  return {
    status: "covered",
    planName: numer ? `Uchwała ${numer}` : null,
    symbol,
    przeznaczenie,
  }
}

// ── Format 6: igeomap.pl direct HTML ──
// <b>plan name</b>
// <i>Uchwała XX/YY/ZZ z dnia YYYY-MM-DD</i>
// <a href="https://mpzp.igeomap.pl/doc/.../NNN.pdf">Pokaż treść uchwały</a>
function parseIgeomapHtml(html: string): { planName: string | null; resolution: string | null; pdfUrl: string | null } {
  const bTags = [...html.matchAll(/<b>([^<]{5,})<\/b>/gi)].map(m => m[1].trim())
  const resolutions = [...html.matchAll(/<i>(Uchwała[^<]+)<\/i>/gi)].map(m => m[1].trim())
  const pdfMatches = [...html.matchAll(/href=["']([^"']+\.pdf)["'][^>]*>\s*Pokaż treść uchwały/gi)]
  const pdfUrl = pdfMatches.length > 0 ? pdfMatches[pdfMatches.length - 1][1] : null
  return {
    planName: bTags.length > 0 ? bTags[bTags.length - 1] : null,
    resolution: resolutions.length > 0 ? resolutions[resolutions.length - 1] : null,
    pdfUrl,
  }
}

// ── Format 7: e-mapa.net iframes ──
async function parseEmapaFeature(html: string): Promise<Record<string, string>> {
  const fields: Record<string, string> = {}
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  for (const line of text.split('\n')) {
    const colon = line.indexOf(':')
    if (colon < 1) continue
    const key = line.substring(0, colon).trim().toLowerCase().replace(/\s+/g, '_')
    const val = line.substring(colon + 1).trim()
    if (key && val && val !== 'null' && val !== '-') fields[key] = val
  }
  return fields
}

async function fetchEmapaElement(domain: string, id: string): Promise<Record<string, string> | null> {
  const url = `https://${domain}/application/modules/pln/pln_gfi.php?id=${id}`
  try {
    console.log(`[e-mapa] ${url}`)
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const html = await res.text()
    const fields = await parseEmapaFeature(html)

    // Match any link that contains getUchwala (regardless of param order)
    const uchwalaMatch = html.match(/href=["']([^"']*getUchwala[^"']*)["']/i)
      || html.match(/href=["']([^"']*request=getUchwala[^"']*)["']/i)
    if (uchwalaMatch) {
      let uUrl = uchwalaMatch[1].replace(/&amp;/g, '&')
      if (uUrl.startsWith('//')) uUrl = `https:${uUrl}`
      else if (!uUrl.startsWith('http')) uUrl = `https://${domain}${uUrl}`
      fields['_uchwala_url'] = uUrl
      const pid = uUrl.match(/[?&]p=(\d+)/)?.[1]
      if (pid) fields['_plan_id'] = pid
    }

    // Also look for a direct PDF link (some communes link directly)
    if (!fields['_uchwala_url']) {
      const pdfMatch = html.match(/href=["']([^"']+\.pdf)["']/i)
      if (pdfMatch) {
        let pUrl = pdfMatch[1].replace(/&amp;/g, '&')
        if (pUrl.startsWith('//')) pUrl = `https:${pUrl}`
        else if (!pUrl.startsWith('http')) pUrl = `https://${domain}${pUrl}`
        fields['_uchwala_url'] = pUrl
      }
    }

    return fields
  } catch (e) {
    console.log(`[e-mapa] Error for id=${id}: ${e.message}`)
    return null
  }
}

// ── PDF download & Supabase Storage upload ──

async function resolvePdfUrl(startUrl: string): Promise<string | null> {
  // Fetch the URL; if it returns HTML, try to extract a direct PDF link from it
  const res = await fetch(startUrl, {
    headers: { 'User-Agent': 'ArchiManager/1.0', 'Accept': 'application/pdf,*/*' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) { console.log(`[store-pdf] HTTP ${res.status} for ${startUrl}`); return null }

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('pdf')) {
    console.log(`[store-pdf] Direct PDF at ${startUrl}`)
    return startUrl
  }

  // Response is HTML — look for a PDF link inside
  const html = await res.text()
  const pdfMatch = html.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i)
  if (pdfMatch) {
    let pdfUrl = pdfMatch[1].replace(/&amp;/g, '&')
    if (pdfUrl.startsWith('//')) pdfUrl = `https:${pdfUrl}`
    else if (!pdfUrl.startsWith('http')) {
      const base = new URL(startUrl)
      pdfUrl = `${base.origin}${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`
    }
    console.log(`[store-pdf] Found PDF link in HTML: ${pdfUrl}`)
    return pdfUrl
  }

  console.log(`[store-pdf] Response is HTML but no PDF link found`)
  return null
}

async function downloadAndStorePdf(actUrl: string, projectId: string, filename: string): Promise<string | null> {
  try {
    console.log(`[store-pdf] Resolving: ${actUrl}`)
    const pdfUrl = await resolvePdfUrl(actUrl)
    if (!pdfUrl) return null

    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'ArchiManager/1.0' },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) { console.log(`[store-pdf] PDF fetch HTTP ${res.status}`); return null }
    const pdfBytes = await res.arrayBuffer()
    console.log(`[store-pdf] Downloaded ${pdfBytes.byteLength} bytes`)
    if (pdfBytes.byteLength < 1000) { console.log('[store-pdf] File too small, likely not a PDF'); return null }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) { console.log('[store-pdf] Missing Supabase credentials'); return null }

    const sb = createClient(supabaseUrl, serviceKey)
    const path = `mpzp/${projectId}/${filename}`
    const { error } = await sb.storage
      .from('project-files')
      .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true })

    if (error) { console.error('[store-pdf] Upload error:', error.message); return null }
    const { data } = sb.storage.from('project-files').getPublicUrl(path)
    console.log(`[store-pdf] Stored: ${data.publicUrl}`)
    return data.publicUrl || null
  } catch (e: unknown) {
    console.error('[store-pdf] Error:', (e as Error).message)
    return null
  }
}

// ── Main KIMPZP query ──

async function queryKIMPZP(lat: number, lng: number): Promise<MpzpResult> {
  const empty: MpzpResult = { status: "unknown", planName: null, symbol: null, przeznaczenie: null, actUrl: null, raw: "" }

  const layers = "wektor-pow,wektor-lin,wektor-str,wektor-pkt,plany"
  let text = await fetchWMS(buildGFI(KIMPZP_URL, layers, lat, lng, "text/html", "1.1.1", 101), "KIMPZP")

  // ServiceException: layers not supported by this commune WMS — try fallback
  if (text && /<ServiceException/i.test(text)) {
    console.log("[KIMPZP] ServiceException — trying fallback layers")
    text = await fetchWMS(
      buildGFI(KIMPZP_URL, "plany,plany_granice", lat, lng, "text/html", "1.1.1", 101),
      "KIMPZP-fallback"
    )
  }

  if (!text || text.length < 20) return empty
  const raw = text.substring(0, 1000)

  // ── 1. Plain text error messages ──
  if (/brak wyniku dla wskazanego obszaru/i.test(text)) {
    console.log("[KIMPZP] → not_covered (brak wyniku)")
    return { ...empty, status: "not_covered", raw }
  }
  if (/brak serwisu dla wskazanego obszaru/i.test(text)) {
    console.log("[KIMPZP] → unknown (brak serwisu)")
    return { ...empty, raw }
  }
  if (/<title>\s*RysunekAktuPlanowania\s*<\/title>/i.test(text)) {
    console.log("[KIMPZP] → raster response, unknown")
    return { ...empty, raw }
  }

  // ── 1b. Empty ESRI / GeoServer response = no features at this point ──
  const isEsri = /esri_wms|FeatureInfoCollection/i.test(text)
  const isGeoserver = /Geoserver GetFeatureInfo output/i.test(text)
  if ((isEsri || isGeoserver) && !/<tr[^>]*>/i.test(text)) {
    console.log("[KIMPZP] → not_covered (empty ESRI/GeoServer body)")
    return { ...empty, status: "not_covered", raw }
  }

  // ── 2. e-mapa.net iframes ──
  const iframeRe = /src=["']?\/\/([^/"']+e-mapa\.net[^/"']*)\/[^?"']*pln_gfi\.php\?id=(\d+)/gi
  const elements: Array<{ domain: string; id: string }> = []
  const seenIds = new Set<string>()
  for (const m of text.matchAll(iframeRe)) {
    if (!seenIds.has(m[2])) { seenIds.add(m[2]); elements.push({ domain: m[1], id: m[2] }) }
  }

  if (elements.length > 0) {
    console.log(`[KIMPZP] → e-mapa format, ${elements.length} element(s)`)
    const fetched = await Promise.all(elements.slice(0, 6).map(({ domain, id }) => fetchEmapaElement(domain, id)))
    const validFeatures = fetched.filter((f): f is Record<string, string> => f !== null)

    if (validFeatures.length === 0) return { ...empty, raw }

    const result: MpzpResult = { ...empty, status: "covered", raw }
    const strFeatures = validFeatures.filter(f => f.typ === "str")
    const powFeatures = validFeatures.filter(f => f.typ === "pow")
    const primary = strFeatures.length > 0 ? strFeatures : powFeatures
    const best = primary[0] || validFeatures[0]

    result.symbol = best.strefa_oznaczenie || best.oznaczenie || best.symbol || null
    result.przeznaczenie = best.opis || best.przeznaczenie || best.funkcja || null

    const withUchwala = validFeatures.find(f => f.uchwala)
    if (withUchwala) {
      const data = withUchwala.data_uchwaly ? ` z dnia ${withUchwala.data_uchwaly}` : ""
      result.planName = `Uchwała ${withUchwala.uchwala}${data}`
    }

    const withActUrl = validFeatures.find(f => f._uchwala_url)
    if (withActUrl) result.actUrl = withActUrl._uchwala_url

    return result
  }

  // ── 3. XML ROWSET (Warszawa Oracle WMS) ──
  if (/<GetFeatureInfo_Result>/i.test(text)) {
    console.log("[KIMPZP] → XML ROWSET format (Warszawa)")
    const parsed = parseRowset(text)
    return { ...empty, ...parsed, raw }
  }

  // ── 4. GeoServer HTML ──
  if (/Geoserver GetFeatureInfo output/i.test(text)) {
    console.log("[KIMPZP] → GeoServer format")
    const parsed = parseGeoserver(text)
    return { ...empty, ...parsed, raw }
  }

  // ── 5. ESRI ArcGIS HTML (Kraków, Wrocław, Opole, Katowice, Poznań) ──
  if (/esri_wms|FeatureInfoCollection/i.test(text)) {
    console.log("[KIMPZP] → ESRI ArcGIS HTML format")
    const parsed = parseEsriHtml(text)
    return { ...empty, ...parsed, raw }
  }

  // ── 6. MapServer GFI HTML (Sopot, Gorzów, Zamość, Rzeszów) ──
  if (/GetFeatureInfo results/i.test(text)) {
    console.log("[KIMPZP] → MapServer GFI format")
    const parsed = parseMapServerGfi(text)
    return { ...empty, ...parsed, raw }
  }

  // ── 7. MapProxy simple HTML (Legnica) ──
  if (/<title>\s*Information\s*<\/title>/i.test(text)) {
    console.log("[KIMPZP] → MapProxy simple HTML format (Legnica)")
    const parsed = parseLegnicaHtml(text)
    return { ...empty, ...parsed, raw }
  }

  // ── 8. igeomap.pl fallback ──
  const igeo = parseIgeomapHtml(text)
  if (igeo.planName || igeo.resolution) {
    console.log("[KIMPZP] → igeomap.pl format")
    return {
      ...empty,
      status: "covered",
      planName: igeo.resolution || igeo.planName,
      actUrl: igeo.pdfUrl,
      raw,
    }
  }

  console.log("[KIMPZP] → no matching format, unknown")
  return { ...empty, raw }
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Action: store act PDF to Supabase Storage
    if (body.action === "storeActPdf") {
      const { actUrl, projectId, filename } = body
      if (!actUrl || !projectId || !filename) {
        return new Response(JSON.stringify({ error: "actUrl, projectId and filename required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }
      const url = await downloadAndStorePdf(actUrl, projectId, filename)
      return new Response(JSON.stringify({ url, error: url ? null : "Failed to download or store PDF" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Default action: parcel info query
    const { lat, lng } = body
    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "lat and lng required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    console.log(`[parcel-info] Point: ${lat}, ${lng}`)

    const [uzytki, mpzp] = await Promise.all([
      queryKIUG(lat, lng),
      queryKIMPZP(lat, lng),
    ])

    return new Response(JSON.stringify({
      uzytki: { available: uzytki.available, oznaczenia: uzytki.oznaczenia, raw: uzytki.raw },
      mpzp: {
        status: mpzp.status,
        planName: mpzp.planName,
        symbol: mpzp.symbol,
        przeznaczenie: mpzp.przeznaczenie,
        actUrl: mpzp.actUrl,
        raw: mpzp.raw,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[parcel-info] Error:", error)
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
