import { APPLICATION_TYPES } from './constants'

/**
 * Bayesian ML prediction engine for application processing times.
 *
 * Cold start: Uses legal deadline as prior (baseline).
 * With data: Bayesian update — prior weight decreases as data accumulates.
 *
 * Weighting: same provider (3x) > same municipality (2x) > generic (1x)
 * Seasonal: multiplier derived from historical monthly patterns (min 10 records)
 * Percentiles: p25/p50/p75/p90 computed from raw data (min 5 records)
 */

// ── Seasonal multiplier ────────────────────────────────────────────────────

function computeSeasonalMultiplier(historicalData, targetMonth) {
  const withMonth = historicalData.filter(h => h.filed_month != null && h.actualDays > 0)
  if (withMonth.length < 10) return 1.0

  const globalAvg = withMonth.reduce((s, h) => s + h.actualDays, 0) / withMonth.length

  const byMonth = {}
  for (const h of withMonth) {
    const m = h.filed_month
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(h.actualDays)
  }

  const monthData = byMonth[targetMonth]
  if (!monthData || monthData.length < 3) return 1.0

  const monthAvg = monthData.reduce((s, v) => s + v, 0) / monthData.length
  // Clamp multiplier to reasonable range (0.5–2.0)
  return Math.min(2.0, Math.max(0.5, monthAvg / globalAvg))
}

// ── Percentile computation ─────────────────────────────────────────────────

function computePercentiles(values) {
  if (values.length < 5) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = (p) => {
    const idx = (p / 100) * (sorted.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  return {
    p25: Math.round(at(25)),
    p50: Math.round(at(50)),
    p75: Math.round(at(75)),
    p90: Math.round(at(90)),
  }
}

// ── Main prediction ────────────────────────────────────────────────────────

/**
 * @param {string} appType - APPLICATION_TYPES key
 * @param {string|null} municipality - city name for weighting
 * @param {Array} historicalData - [{type, actualDays, municipality, provider, filed_month}]
 * @param {string|null} provider - e.g. road_class for ZJAZD ('Gminna', 'Powiatowa', ...)
 */
export function predictDays(appType, municipality = null, historicalData = [], provider = null) {
  const base = APPLICATION_TYPES[appType]
  if (!base || !base.legalDays) {
    return { predicted: null, lower: null, upper: null, confidence: 0, basis: 'brak danych' }
  }

  const legalDays = base.legalDays
  const currentMonth = new Date().getMonth() + 1

  const relevant = historicalData.filter(h => h.type === appType)

  if (relevant.length === 0) {
    const predicted = Math.round(legalDays * 0.75)
    return {
      predicted,
      lower: Math.round(legalDays * 0.4),
      upper: legalDays,
      p25: Math.round(legalDays * 0.5),
      p50: predicted,
      p75: Math.round(legalDays * 0.85),
      p90: legalDays,
      confidence: 0.3,
      seasonalMultiplier: 1.0,
      basis: 'termin ustawowy (brak danych historycznych)',
      dataPoints: 0,
    }
  }

  // Seasonal multiplier derived from data
  const seasonalMultiplier = computeSeasonalMultiplier(relevant, currentMonth)

  // Classify records by weight tier
  const sameProvider = provider
    ? relevant.filter(h => h.provider && h.provider === provider)
    : []
  const sameMunicipality = municipality
    ? relevant.filter(h => h.municipality === municipality && !sameProvider.includes(h))
    : []

  // Bayesian update with weighted observations
  const priorMean = legalDays * 0.75
  const priorWeight = 3
  let totalWeight = priorWeight
  let weightedSum = priorWeight * priorMean

  relevant.forEach(h => {
    let w = 1
    if (sameProvider.includes(h)) w = 3
    else if (sameMunicipality.includes(h)) w = 2
    weightedSum += w * h.actualDays
    totalWeight += w
  })

  const posteriorMean = (weightedSum / totalWeight) * seasonalMultiplier

  // Percentiles from raw data (not adjusted seasonally — they are empirical)
  const percentiles = computePercentiles(relevant.map(h => h.actualDays))

  // Standard deviation for fallback CI
  const n = relevant.length
  const avgActual = relevant.reduce((s, h) => s + h.actualDays, 0) / n
  const variance = relevant.reduce((s, h) => s + Math.pow(h.actualDays - avgActual, 2), 0) / Math.max(n - 1, 1)
  const std = Math.sqrt(variance)
  const ciMult = n < 5 ? 2.0 : n < 10 ? 1.5 : 1.2

  const lower = percentiles?.p25 ?? Math.max(1, Math.round(posteriorMean - ciMult * (std || 5)))
  const upper = percentiles?.p75 ?? Math.round(posteriorMean + ciMult * (std || 5))
  const p90 = percentiles?.p90 ?? Math.round(posteriorMean + 1.65 * (std || 5))

  // Confidence
  const confidence = Math.min(
    0.95,
    0.3 + n * 0.08
      + (sameProvider.length > 0 ? 0.15 : 0)
      + (sameMunicipality.length > 0 ? 0.1 : 0)
  )

  // Basis description
  const basisParts = []
  if (sameProvider.length > 0) basisParts.push(`${sameProvider.length} z tego zarządcy`)
  if (sameMunicipality.length > 0) basisParts.push(`${sameMunicipality.length} z tej gminy`)
  const otherCount = n - sameProvider.length - sameMunicipality.length
  if (otherCount > 0) basisParts.push(`${otherCount} ogólnych`)
  const seasonNote = seasonalMultiplier !== 1.0
    ? ` · korekta sezonowa ×${seasonalMultiplier.toFixed(2)}`
    : ''

  return {
    predicted: Math.round(posteriorMean),
    lower,
    upper,
    p25: percentiles?.p25 ?? lower,
    p50: percentiles?.p50 ?? Math.round(posteriorMean),
    p75: percentiles?.p75 ?? upper,
    p90,
    confidence,
    seasonalMultiplier,
    basis: `${n} wniosków (${basisParts.join(', ')})${seasonNote}`,
    dataPoints: n,
  }
}

// ── Project timeline ───────────────────────────────────────────────────────

export function predictProjectTimeline(applications, historicalData = []) {
  const predictions = applications
    .filter(a => a.status !== 'DONE')
    .map(a => ({
      type: a.type,
      prediction: predictDays(a.type, null, historicalData),
    }))
    .filter(p => p.prediction.predicted !== null)

  if (predictions.length === 0) return null

  const criticalPath = predictions.reduce((max, p) =>
    p.prediction.predicted > max.prediction.predicted ? p : max
  )

  const permitDays = 65 + 14

  return {
    criticalApplication: criticalPath.type,
    applicationDays: criticalPath.prediction.predicted,
    applicationRange: { lower: criticalPath.prediction.lower, upper: criticalPath.prediction.upper },
    totalWithPermit: criticalPath.prediction.predicted + permitDays,
    permitDays,
    predictions,
  }
}
