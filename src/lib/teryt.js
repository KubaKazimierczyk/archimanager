/**
 * TERYT / adres — ArchiManager
 *
 * Wyszukiwanie adresu oparte na Nominatim (OpenStreetMap) — CORS, bezpłatne,
 * działa bezpośrednio z przeglądarki bez proxy.
 *
 * Jako wzmocnienie dla wyszukiwania ulic używany jest Supabase Edge Function
 * wywołujący GUS TERYT WS1 SOAP (gdy Supabase skonfigurowany i mamy SIMC).
 */

import { supabase, isSupabaseConfigured } from './supabase'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const HEADERS = {
  'User-Agent': 'ArchiManager/1.0',
  'Accept-Language': 'pl,en',
}

// Typy adresów Nominatim uznawane za miejscowość
const CITY_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'])

async function nominatimGet(params) {
  const url = `${NOMINATIM}/search?${new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    countrycodes: 'pl',
    limit: '15',
    ...params,
  })}`
  console.log('[Nominatim]', url)
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  return res.json()
}

/** Wyciągnij nazwę miejscowości z obiektu address Nominatim */
function cityFromAddress(address) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    ''
  )
}

function cleanState(s = '') {
  return s.toLowerCase().replace(/^województwo\s+/i, '')
}
function cleanCounty(s = '') {
  return s.toLowerCase().replace(/^powiat\s+/i, '')
}
function cleanCommune(s = '') {
  return s.replace(/^gmina\s+/i, '')
}

// ── Public API ────────────────────────────────────────────────────────────────

export const terytApi = {
  /**
   * Wyszukaj miejscowość.
   * Zwraca [{ city, province, county, commune, postalCode, terytId }]
   */
  async searchCity(query) {
    if (!query || query.length < 2) return []

    try {
      const raw = await nominatimGet({ q: `${query}, Polska` })

      const seen = new Set()
      const results = []

      for (const r of raw) {
        const addr = r.address || {}

        // Filtruj tylko jednostki osadnicze z rozpoznawalnym polem city/town/village
        const city = cityFromAddress(addr)
        if (!city) continue

        // Odfiltruj duplikaty (ta sama miejscowość + województwo)
        const key = `${city}|${addr.state || ''}`
        if (seen.has(key)) continue
        seen.add(key)

        results.push({
          city,
          province:   cleanState(addr.state),
          county:     cleanCounty(addr.county),
          commune:    cleanCommune(addr.municipality || city),
          postalCode: addr.postcode || '',
          terytId:    '',  // Nominatim nie podaje SIMC — ulice przez Nominatim też
        })

        if (results.length >= 10) break
      }

      return results
    } catch (e) {
      console.warn('[TERYT] city search error:', e.message)
      return []
    }
  },

  /**
   * Wyszukaj numer budynku na danej ulicy w danej miejscowości via Nominatim.
   * Zwraca [{ number }]
   */
  async searchHouseNumber(cityName, streetName, query) {
    if (!cityName || !streetName || !query || query.length < 1) return []
    const cleanStreet = streetName.replace(/^(ul\.|al\.|pl\.|os\.)\s*/i, '').trim()
    try {
      const raw = await nominatimGet({
        q: `${query} ${cleanStreet}, ${cityName}, Polska`,
        limit: '20',
      })
      const seen = new Set()
      return raw
        .filter(r => r.address?.house_number)
        .map(r => r.address.house_number)
        .filter(n => {
          const norm = n.toLowerCase()
          if (seen.has(norm)) return false
          seen.add(norm)
          return norm.startsWith(query.toLowerCase())
        })
        .slice(0, 10)
    } catch (e) {
      console.warn('[TERYT] house number search error:', e.message)
      return []
    }
  },

  /**
   * Wyszukaj ulicę w danej miejscowości.
   * 1. Supabase Edge Function → GUS TERYT SOAP (gdy cityTerytId dostępny)
   * 2. Nominatim structured search: street + city jako osobne parametry
   * 3. Nominatim free-form fallback z pełną nazwą
   */
  async searchStreet(cityTerytId, query, cityName = '') {
    if (!query || query.length < 2) return []

    // 1. Supabase Edge Function → GUS TERYT SOAP
    if (isSupabaseConfigured() && cityTerytId) {
      try {
        const { data, error } = await supabase.functions.invoke('teryt-search', {
          body: { action: 'searchStreet', cityId: cityTerytId, query },
        })
        if (!error && data?.data?.length > 0) return data.data
      } catch (e) {
        console.warn('[TERYT] Edge Function street error:', e.message)
      }
    }

    const queryLower = query.toLowerCase()

    function extractStreets(raw) {
      const seen = new Set()
      return raw
        .filter(r => r.address?.road)
        .map(r => {
          const road = r.address.road
          const prefix = /^(aleja|al\.|plac|pl\.|rynek|osiedle|os\.)/i.test(road)
            ? road.split(/\s+/)[0]
            : 'ul.'
          return { name: road, prefix }
        })
        .filter(r => {
          if (!r.name.toLowerCase().includes(queryLower)) return false
          if (seen.has(r.name)) return false
          seen.add(r.name)
          return true
        })
        .slice(0, 10)
    }

    // 2. Nominatim structured: street + city jako osobne pola — najlepsza trafność
    if (cityName) {
      try {
        const raw = await nominatimGet({ street: query, city: cityName })
        const results = extractStreets(raw)
        if (results.length > 0) return results
      } catch (e) {
        console.warn('[TERYT] structured street search error:', e.message)
      }
    }

    // 3. Fallback: pełna fraza (nie skracamy — skrócenie do 3 znaków szkodzi)
    const q = cityName ? `${query}, ${cityName}, Polska` : `${query}, Polska`
    try {
      const raw = await nominatimGet({ q })
      return extractStreets(raw)
    } catch (e) {
      console.warn('[TERYT] street search error:', e.message)
      return []
    }
  },
}
