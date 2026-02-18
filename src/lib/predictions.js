import { APPLICATION_TYPES } from './constants'

/**
 * Bayesian ML prediction engine for application processing times.
 * 
 * Cold start: Uses legal deadline as prior (baseline).
 * With data: Bayesian update — prior weight decreases as data accumulates.
 * 
 * Features considered (for future enhancement):
 * - Application type
 * - Municipality (different offices have different speeds)
 * - Season/month (holiday periods are slower)
 * - Whether MPZP exists or WZ needed
 * - Historical average for specific office
 */

export function predictDays(appType, municipality = null, historicalData = []) {
  const base = APPLICATION_TYPES[appType]
  if (!base || !base.legalDays) {
    return { predicted: null, lower: null, upper: null, confidence: 0, basis: 'brak danych' }
  }

  const legalDays = base.legalDays

  // Filter relevant historical data
  let relevant = historicalData.filter(h => h.type === appType)
  
  // If municipality provided, boost weight of same-municipality data
  const sameMunicipality = municipality 
    ? relevant.filter(h => h.municipality === municipality) 
    : []

  if (relevant.length === 0) {
    // Cold start — prior based on legal deadline
    // Most offices respond before deadline, so we use 75% as expected value
    const predicted = Math.round(legalDays * 0.75)
    return {
      predicted,
      lower: Math.round(legalDays * 0.4),
      upper: legalDays,
      confidence: 0.3,
      basis: 'termin ustawowy (brak danych historycznych)',
      dataPoints: 0,
    }
  }

  // Bayesian update
  const priorMean = legalDays * 0.75
  const priorWeight = 3 // Equivalent to 3 "virtual" observations

  // Compute weighted average (municipality-specific data gets 2x weight)
  let totalWeight = priorWeight
  let weightedSum = priorWeight * priorMean
  
  relevant.forEach(h => {
    const w = sameMunicipality.includes(h) ? 2 : 1
    weightedSum += w * h.actualDays
    totalWeight += w
  })
  
  const posteriorMean = weightedSum / totalWeight

  // Compute standard deviation
  const n = relevant.length
  const avgActual = relevant.reduce((s, h) => s + h.actualDays, 0) / n
  const variance = relevant.reduce((s, h) => s + Math.pow(h.actualDays - avgActual, 2), 0) / Math.max(n - 1, 1)
  const std = Math.sqrt(variance)

  // Confidence interval (wider with less data)
  const confidenceMultiplier = n < 5 ? 2.0 : n < 10 ? 1.5 : 1.2
  const lower = Math.max(1, Math.round(posteriorMean - confidenceMultiplier * (std || 5)))
  const upper = Math.round(posteriorMean + confidenceMultiplier * (std || 5))

  // Confidence score (0-1)
  const confidence = Math.min(0.95, 0.3 + n * 0.08 + (sameMunicipality.length > 0 ? 0.1 : 0))

  return {
    predicted: Math.round(posteriorMean),
    lower,
    upper,
    confidence,
    basis: sameMunicipality.length > 0 
      ? `${n} wniosków (w tym ${sameMunicipality.length} z tej gminy)`
      : `${n} wniosków historycznych`,
    dataPoints: n,
  }
}

/**
 * Predict total project timeline based on all application predictions.
 * The critical path is determined by the longest application.
 */
export function predictProjectTimeline(applications, historicalData = []) {
  const predictions = applications
    .filter(a => a.status !== 'DONE')
    .map(a => ({
      type: a.type,
      prediction: predictDays(a.type, null, historicalData),
    }))
    .filter(p => p.prediction.predicted !== null)

  if (predictions.length === 0) return null

  // Critical path = longest predicted wait
  const criticalPath = predictions.reduce((max, p) => 
    p.prediction.predicted > max.prediction.predicted ? p : max
  )

  // Total including 65 days for building permit + 14 days finalization
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
