// supabase/functions/mpzp-analyze/index.ts
// Deploy: supabase functions deploy mpzp-analyze
//
// Analyzes an MPZP PDF using Claude AI.
// Actions:
//   extract — extract zoning parameters as structured JSON
//   chat    — answer a free-form question about the plan

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize))
  }
  return btoa(binary)
}

const EXTRACT_PROMPT = `Przeanalizuj ten dokument MPZP (Miejscowy Plan Zagospodarowania Przestrzennego) i wyodrębnij parametry dla działki objętej planem. Zwróć WYŁĄCZNIE poprawny obiekt JSON — bez markdown, bez komentarzy, bez żadnego dodatkowego tekstu:

{
  "teren": "symbol terenu z rysunku lub tekstu planu, np. '22.39MN/U', '1MN', '3U/MW' — sam symbol bez opisu, lub null",
  "purpose": "przeznaczenie podstawowe terenu (symbol + pełna nazwa, np. 'MN — zabudowa mieszkaniowa jednorodzinna')",
  "purpose_allowed": "przeznaczenie dopuszczalne — co jest dozwolone uzupełniająco, lub null jeśli brak",
  "usage_rules": "główne zasady użytkowania i zagospodarowania terenu (max 4 zdania, konkretnie)",
  "building_height": "maksymalna wysokość zabudowy (np. 'do 9 m' lub null)",
  "facade_length": "maksymalna długość elewacji frontowej (np. 'max 20 m' lub null)",
  "ridge_height": "wysokość budynku lub kalenicy (np. 'max 10 m nad poziom terenu' lub null)",
  "roof_geometry": "dopuszczalne geometrie dachu (np. 'dachy dwuspadowe lub czterospadowe' lub null)",
  "roof_angle": "kąt nachylenia połaci dachowej (np. '30°–45°' lub null)",
  "building_coverage": "maksymalny wskaźnik powierzchni zabudowy w % — podaj tylko liczbę (np. '30' lub null)",
  "bio_area": "minimalny udział powierzchni biologicznie czynnej w % — podaj tylko liczbę (np. '60' lub null)",
  "intensity": "wskaźnik intensywności zabudowy (np. '0.4–0.8' lub null)",
  "building_location": "zasady lokalizacji budynku względem działek sąsiednich (np. 'min. 4 m od granicy działki sąsiedniej' lub null)",
  "building_line": "linia zabudowy (np. 'obowiązująca 6 m od linii rozgraniczającej drogi' lub null)",
  "parking": "minimalna liczba miejsc parkingowych (np. '2 na 1 lokal mieszkalny' lub null)"
}`

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { pdfUrl, action, question } = await req.json()

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Brak klucza API Anthropic" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "Brak URL pliku PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Download PDF
    console.log(`[mpzp-analyze] Downloading PDF: ${pdfUrl.substring(0, 100)}...`)
    const pdfResp = await fetch(pdfUrl, { signal: AbortSignal.timeout(30000) })
    if (!pdfResp.ok) {
      return new Response(
        JSON.stringify({ error: `Nie można pobrać PDF (HTTP ${pdfResp.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const pdfBuffer = await pdfResp.arrayBuffer()
    const pdfBase64 = arrayBufferToBase64(pdfBuffer)
    console.log(`[mpzp-analyze] PDF size: ${Math.round(pdfBuffer.byteLength / 1024)} KB, action: ${action}`)

    const userPrompt = action === "extract"
      ? EXTRACT_PROMPT
      : (question?.trim() || "Opisz najważniejsze zasady zagospodarowania terenu z tego MPZP.")

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: action === "extract" ? 1500 : 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        }],
      }),
    })

    const aiData = await response.json()

    if (!response.ok) {
      const errMsg = aiData.error?.message || JSON.stringify(aiData)
      console.error("[mpzp-analyze] Anthropic API error:", errMsg)
      return new Response(
        JSON.stringify({ error: `Błąd API Anthropic: ${errMsg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const text = aiData.content?.[0]?.text || ""

    if (action === "extract") {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error("No JSON found in response")
        const extracted = JSON.parse(jsonMatch[0])
        return new Response(
          JSON.stringify({ extracted }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      } catch (e) {
        console.error("[mpzp-analyze] JSON parse error:", e.message, "| text:", text.substring(0, 300))
        return new Response(
          JSON.stringify({ error: "Błąd parsowania odpowiedzi AI", raw: text }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    return new Response(
      JSON.stringify({ answer: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("[mpzp-analyze] Error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Nieznany błąd serwera" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
