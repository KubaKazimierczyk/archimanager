// supabase/functions/teryt-search/index.ts
// Deploy: supabase functions deploy teryt-search
//
// Proxy to the official GUS TERYT WS1 SOAP API.
// Set env vars in Supabase Dashboard → Settings → Edge Functions:
//   TERYT_WSDL_URL   https://uslugaterytws1.stat.gov.pl/TerytWs1.svc
//   TERYT_USERNAME   <registered GUS username>
//   TERYT_PASSWORD   <registered GUS password>
// Without env vars, falls back to public test endpoint (TestPubliczny / 1234abcd).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const TERYT_URL  = Deno.env.get("TERYT_WSDL_URL") ?? "https://uslugaterytws1test.stat.gov.pl/TerytWs1.svc"
const TERYT_USER = Deno.env.get("TERYT_USERNAME")  ?? "TestPubliczny"
const TERYT_PASS = Deno.env.get("TERYT_PASSWORD")  ?? "1234abcd"
const TODAY = new Date().toISOString().split("T")[0]

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ── SOAP helpers ─────────────────────────────────────────────────────────────

function soapEnvelope(method: string, params: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ter="http://tempuri.org/">
  <soap:Header>
    <wsse:Security
      xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${TERYT_USER}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${TERYT_PASS}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <ter:${method}>
      ${params}
    </ter:${method}>
  </soap:Body>
</soap:Envelope>`
}

async function callSoap(method: string, params: string): Promise<string> {
  const res = await fetch(TERYT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `http://tempuri.org/ITerytWs1/${method}`,
    },
    body: soapEnvelope(method, params),
  })
  if (!res.ok) throw new Error(`SOAP HTTP ${res.status}`)
  return res.text()
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<[^:>]*:?${name}[^>]*>([^<]*)<`, "i"))
  return m ? m[1].trim() : ""
}

function blocks(xml: string, name: string): string[] {
  const re = new RegExp(`<[^:>]*:?${name}[^>]*>[\\s\\S]*?</[^:>]*:?${name}>`, "gi")
  return [...xml.matchAll(re)].map(m => m[0])
}

// ── City search ───────────────────────────────────────────────────────────────

async function searchCity(query: string) {
  // WyszukajMiejscowoscWRejestrze — search locality in the TERYT register
  const xml = await callSoap("WyszukajMiejscowoscWRejestrze", `
    <ter:nazwaWzworiec>%${query}%</ter:nazwaWzworiec>
    <ter:DataStanu>${TODAY}</ter:DataStanu>
  `)

  let items = blocks(xml, "JednostkaMiejscowosci")
  if (items.length === 0) items = blocks(xml, "MiejscowoscNazwa")

  return items.slice(0, 12).map(b => ({
    city:       tag(b, "Nazwa"),
    province:   (tag(b, "Wojew") || tag(b, "Woj")).toLowerCase(),
    county:     (tag(b, "Powiat") || tag(b, "Pow")).toLowerCase(),
    commune:    tag(b, "Gmina") || tag(b, "Gm"),
    terytId:    tag(b, "SymbolMiejsc") || tag(b, "Symbol") || tag(b, "Sym"),
    postalCode: tag(b, "KodPocztowy") || "",
  })).filter(r => r.city)
}

// ── Street search ─────────────────────────────────────────────────────────────

async function searchStreet(cityId: string, streetQuery: string) {
  // WyszukajUliceWRejestrze — search streets in the TERYT register
  const xml = await callSoap("WyszukajUliceWRejestrze", `
    <ter:nazwaWzworiec>%${streetQuery}%</ter:nazwaWzworiec>
    <ter:identyfikatorMiejscowosci>${cityId}</ter:identyfikatorMiejscowosci>
    <ter:DataStanu>${TODAY}</ter:DataStanu>
  `)

  let items = blocks(xml, "UlicaDrzewo")
  if (items.length === 0) items = blocks(xml, "UlicaNazwa")

  return items.slice(0, 12).map(b => ({
    name:   tag(b, "NazwaUlicy") || tag(b, "Nazwa"),
    prefix: tag(b, "CechaUlicy") || tag(b, "Cecha") || "ul.",
    id:     tag(b, "IdentyfikatorUlicy") || tag(b, "Sym"),
  })).filter(r => r.name)
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { action, query, cityId } = await req.json()
    const data = action === "searchStreet"
      ? await searchStreet(cityId, query)
      : await searchCity(query)

    return new Response(JSON.stringify({ data, error: null }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[teryt-search]", err)
    return new Response(
      JSON.stringify({ data: null, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    )
  }
})
