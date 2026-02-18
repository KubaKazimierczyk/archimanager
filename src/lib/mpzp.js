/**
 * Parcel Info Service v3
 * 
 * Calls Supabase Edge Function "parcel-info" which queries:
 *   1. KIUG (GUGiK) — użytki gruntowe + klasy bonitacyjne
 *   2. KIMPZP (GUGiK) — miejscowy plan zagospodarowania przestrzennego
 *
 * Both are national WMS services queried server-side (no CORS issues).
 */

import { supabase, isSupabaseConfigured } from './supabase'

function guessPortalUrl(communeName) {
  const slug = (communeName || 'unknown')
    .toLowerCase().replace(/\s+/g, '-')
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
    .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
  return `https://${slug}.e-mapa.net/`
}

/**
 * Fetch both land use and MPZP data for a point.
 * Requires centroid (lat/lng) from ULDK parcel geometry.
 */
export async function fetchParcelInfo(centroid, communeName) {
  const portalUrl = guessPortalUrl(communeName)

  if (!centroid || !centroid.lat || !centroid.lng) {
    return {
      uzytki: { available: false, oznaczenia: [], note: 'Brak współrzędnych — wyszukaj działkę w ULDK.' },
      mpzp: { status: 'unknown', planName: null, planSymbol: null, portalUrl, note: 'Brak współrzędnych.' },
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      uzytki: { available: false, oznaczenia: [], note: 'Deploy Edge Function "parcel-info" aby pobierać dane z KIUG.' },
      mpzp: { status: 'unknown', planName: null, planSymbol: null, portalUrl, note: 'Deploy Edge Function "parcel-info" aby sprawdzać MPZP.' },
    }
  }

  try {
    console.log('[parcel-info] Calling Edge Function for:', centroid)
    const { data, error } = await supabase.functions.invoke('parcel-info', {
      body: { lat: centroid.lat, lng: centroid.lng },
    })

    if (error) {
      console.error('[parcel-info] Edge Function error:', error)
      return {
        uzytki: { available: false, oznaczenia: [], note: `Błąd: ${error.message}` },
        mpzp: { status: 'unknown', planName: null, planSymbol: null, portalUrl, note: `Błąd: ${error.message}` },
      }
    }

    const uzytki = {
      available: data?.uzytki?.available || false,
      oznaczenia: data?.uzytki?.oznaczenia || [],
      raw: data?.uzytki?.raw || '',
      note: data?.uzytki?.available
        ? `Użytki: ${(data.uzytki.oznaczenia || []).join(', ')}`
        : 'Brak danych o użytkach dla tego powiatu.',
    }

    const mpzpData = data?.mpzp || {}
    const mpzp = {
      status: mpzpData.status || 'unknown',
      planName: mpzpData.planName || null,
      planSymbol: mpzpData.symbol || null,
      przeznaczenie: mpzpData.przeznaczenie || null,
      actUrl: mpzpData.actUrl || null,
      raw: mpzpData.raw || '',
      portalUrl,
      note: mpzpData.status === 'covered'
        ? `Teren objęty MPZP${mpzpData.planName ? ': ' + mpzpData.planName : ''}.${mpzpData.przeznaczenie ? ' Przeznaczenie: ' + mpzpData.przeznaczenie : ''}`
        : mpzpData.status === 'not_covered'
        ? 'Brak MPZP — wymagane warunki zabudowy (WZ).'
        : 'Status MPZP nieznany — sprawdź na geoportalu.',
    }

    return { uzytki, mpzp }
  } catch (err) {
    console.error('[parcel-info] Error:', err)
    return {
      uzytki: { available: false, oznaczenia: [], note: `Błąd: ${err.message}` },
      mpzp: { status: 'unknown', planName: null, planSymbol: null, portalUrl, note: `Błąd: ${err.message}` },
    }
  }
}

/**
 * Download MPZP act PDF via Edge Function and store in Supabase Storage.
 * Called after project is created so we have the project ID.
 * Returns public URL of the stored file, or null on failure.
 */
export async function storeMpzpPdf(projectId, actUrl, filename) {
  if (!isSupabaseConfigured() || !actUrl || !projectId) return null
  try {
    console.log('[mpzp] Storing PDF for project:', projectId)
    const { data, error } = await supabase.functions.invoke('parcel-info', {
      body: { action: 'storeActPdf', actUrl, projectId, filename },
    })
    if (error) { console.error('[mpzp] storeMpzpPdf error:', error); return null }
    return data?.url || null
  } catch (e) {
    console.error('[mpzp] storeMpzpPdf error:', e.message)
    return null
  }
}

// Backward compatibility
export async function lookupMpzp(communeTerytId, communeName, centroid) {
  const result = await fetchParcelInfo(centroid, communeName)
  return result.mpzp
}

export const mpzpApi = { lookupMpzp, fetchParcelInfo, storeMpzpPdf }
