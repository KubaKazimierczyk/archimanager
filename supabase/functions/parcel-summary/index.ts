import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const parcel = await req.json()
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ summary: generateFallback(parcel), source: "local" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const prompt = `Jesteś asystentem architekta w Polsce. Na podstawie danych o działce przygotuj zwięzłe podsumowanie (3-5 akapitów po polsku):

1. **Lokalizacja i identyfikacja** — gdzie jest działka, obręb, gmina
2. **Charakterystyka terenu** — użytki gruntowe i klasa gleby z interpretacją co to oznacza dla inwestycji (odrolnienie, ograniczenia)
3. **Status planistyczny** — czy jest MPZP, jakie przeznaczenie, co wolno budować. Jeśli brak danych MPZP z API — zaznacz że trzeba sprawdzić ręcznie na geoportalu gminnym.
4. **Zalecenia dla architekta** — konkretne kroki: jakie wnioski złożyć, potencjalne problemy, co sprawdzić

Dane działki:
- Numer: ${parcel.number || 'brak'}
- Obręb: ${parcel.precinct || 'brak'}
- TERYT: ${parcel.teryt_id || 'brak'}
- Gmina: ${parcel.commune_name || 'brak'}, Powiat: ${parcel.county_name || 'brak'}, Woj.: ${parcel.voivodeship || 'brak'}
- Powierzchnia: ${parcel.area ? parcel.area + ' m²' : 'brak'}
- Użytki gruntowe (kody): ${parcel.land_use || 'brak danych z KIUG'}
- Użytki szczegółowo: ${parcel.land_use_parsed || 'brak opisu'}
- MPZP status: ${parcel.mpzp_status === 'covered' ? 'Jest MPZP' : parcel.mpzp_status === 'not_covered' ? 'Brak MPZP (wymagane WZ)' : 'Nieznany — API nie zwróciło danych'}
- Nazwa planu MPZP: ${parcel.mpzp_plan_name || 'brak'}
- Przeznaczenie w MPZP: ${parcel.mpzp_przeznaczenie || parcel.purpose || 'brak'}
- Symbol MPZP: ${parcel.mpzp_symbol || 'brak'}
- Typ planowanego budynku: ${parcel.building_type || 'brak'}

Pisz konkretnie i praktycznie. Nie powtarzaj surowych danych — interpretuj je. Jeśli brak danych o użytkach lub MPZP z API, wyraźnie zaznacz co trzeba sprawdzić ręcznie i gdzie (starostwo, urząd gminy, geoportal).`

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    const data = await response.json()
    const summary = data.content?.[0]?.text || generateFallback(parcel)

    return new Response(
      JSON.stringify({ summary, source: "ai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("[parcel-summary] Error:", error)
    return new Response(
      JSON.stringify({ summary: generateFallback({}), source: "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

function generateFallback(p) {
  const parts = []
  const loc = [p.precinct, p.commune_name, p.county_name, p.voivodeship].filter(Boolean).join(', ')
  if (loc) parts.push(`Działka nr ${p.number || '?'} położona w obrębie ${loc}.${p.area ? ` Powierzchnia: ${Number(p.area).toLocaleString('pl')} m².` : ''}`)

  if (p.land_use) {
    const hasAgri = /\b[RPS]/.test(p.land_use)
    const hasForest = /\bL[sz]/.test(p.land_use)
    let desc = `Użytki gruntowe: ${p.land_use}.`
    if (p.land_use_parsed) desc += ` ${p.land_use_parsed}`
    if (hasAgri) desc += ' Teren zawiera grunty rolne — może wymagać odrolnienia.'
    if (hasForest) desc += ' Obecność gruntów leśnych — wymagane odlesienie.'
    parts.push(desc)
  } else {
    parts.push('Brak danych o użytkach gruntowych z KIUG — sprawdź w starostwie powiatowym lub na geoportalu.')
  }

  if (p.mpzp_status === 'covered') {
    let m = 'Działka objęta MPZP.'
    if (p.mpzp_plan_name) m += ` Plan: ${p.mpzp_plan_name}.`
    if (p.mpzp_przeznaczenie || p.purpose) m += ` Przeznaczenie: ${p.mpzp_przeznaczenie || p.purpose}.`
    parts.push(m)
  } else if (p.mpzp_status === 'not_covered') {
    parts.push('Brak MPZP — konieczne uzyskanie warunków zabudowy (WZ) z urzędu gminy.')
  } else {
    parts.push('Status MPZP nieznany z API. Sprawdź na geoportalu gminnym lub w urzędzie gminy.')
  }

  const recs = []
  if (p.land_use && /\b[RPS]/.test(p.land_use)) recs.push('wniosek o wyłączenie z produkcji rolnej')
  if (p.mpzp_status === 'not_covered') recs.push('uzyskanie warunków zabudowy')
  if (!p.land_use) recs.push('weryfikacja użytków w starostwie')
  recs.push('sprawdzenie uzbrojenia terenu', 'weryfikacja dostępu do drogi publicznej')
  parts.push(`Zalecane kroki: ${recs.join(', ')}.`)

  return parts.join('\n\n')
}
