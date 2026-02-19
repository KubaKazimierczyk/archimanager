import { describe, it, expect } from 'vitest'
import { predictDays, predictProjectTimeline } from '../lib/predictions'

const ZJAZD_LEGAL_DAYS = 30
const WOD_KAN_LEGAL_DAYS = 21
const ENERGIA_LEGAL_DAYS = 21

describe('predictDays — no historical data', () => {
  it('returns prior-based estimate for ZJAZD', () => {
    const result = predictDays('ZJAZD', null, [])
    expect(result.predicted).toBe(Math.round(ZJAZD_LEGAL_DAYS * 0.75)) // 23
    expect(result.confidence).toBe(0.3)
    expect(result.lower).toBeGreaterThan(0)
    expect(result.upper).toBeLessThanOrEqual(ZJAZD_LEGAL_DAYS)
    expect(result.dataPoints).toBe(0)
  })

  it('returns null prediction for ADAPTACJA (no legalDays)', () => {
    const result = predictDays('ADAPTACJA', null, [])
    expect(result.predicted).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('returns null prediction for unknown type', () => {
    const result = predictDays('UNKNOWN_TYPE', null, [])
    expect(result.predicted).toBeNull()
  })
})

describe('predictDays — with historical data', () => {
  const historicalData = [
    { type: 'ZJAZD', actualDays: 22, municipality: 'Piaseczno', provider: 'Gminna', filed_month: 3 },
    { type: 'ZJAZD', actualDays: 28, municipality: 'Piaseczno', provider: 'Gminna', filed_month: 8 },
    { type: 'ZJAZD', actualDays: 18, municipality: 'Grodzisk', provider: 'Gminna', filed_month: 5 },
    { type: 'ZJAZD', actualDays: 35, municipality: 'Warszawa', provider: 'Powiatowa', filed_month: 7 },
  ]

  it('uses historical data and increases confidence', () => {
    const result = predictDays('ZJAZD', null, historicalData)
    expect(result.dataPoints).toBe(4)
    expect(result.confidence).toBeGreaterThan(0.3)
    expect(result.predicted).toBeGreaterThan(0)
  })

  it('weights same provider records higher', () => {
    const withProvider = predictDays('ZJAZD', null, historicalData, 'Gminna')
    const withoutProvider = predictDays('ZJAZD', null, historicalData)
    // Same provider weighting (3x) > no provider weighting (1x)
    expect(withProvider.confidence).toBeGreaterThanOrEqual(withoutProvider.confidence)
  })

  it('weights same municipality records higher than generic', () => {
    const withMunicipality = predictDays('ZJAZD', 'Piaseczno', historicalData)
    const withoutMunicipality = predictDays('ZJAZD', null, historicalData)
    expect(withMunicipality.confidence).toBeGreaterThanOrEqual(withoutMunicipality.confidence)
  })

  it('returns percentiles when ≥5 records', () => {
    const largeData = [
      ...historicalData,
      { type: 'ZJAZD', actualDays: 20, municipality: 'Kraków', provider: 'Gminna', filed_month: 1 },
    ]
    const result = predictDays('ZJAZD', null, largeData)
    expect(result.p25).toBeDefined()
    expect(result.p50).toBeDefined()
    expect(result.p75).toBeDefined()
    expect(result.p90).toBeDefined()
    expect(result.p25).toBeLessThanOrEqual(result.p50)
    expect(result.p50).toBeLessThanOrEqual(result.p75)
    expect(result.p75).toBeLessThanOrEqual(result.p90)
  })

  it('confidence caps at 0.95', () => {
    const manyRecords = Array.from({ length: 20 }, (_, i) => ({
      type: 'ZJAZD', actualDays: 20 + i, municipality: 'Piaseczno', provider: 'Gminna', filed_month: 3,
    }))
    const result = predictDays('ZJAZD', 'Piaseczno', manyRecords, 'Gminna')
    expect(result.confidence).toBeLessThanOrEqual(0.95)
  })

  it('WOD_KAN predictions use correct legal days', () => {
    const wodData = [
      { type: 'WOD_KAN', actualDays: 15, municipality: 'Piaseczno', provider: null, filed_month: 4 },
    ]
    const result = predictDays('WOD_KAN', null, wodData)
    expect(result.upper).toBeLessThanOrEqual(WOD_KAN_LEGAL_DAYS * 2)
  })

  it('lower bound is always positive', () => {
    const result = predictDays('ZJAZD', null, historicalData)
    expect(result.lower).toBeGreaterThan(0)
  })
})

describe('predictProjectTimeline', () => {
  it('returns null when all applications are DONE', () => {
    const apps = [
      { type: 'ZJAZD', status: 'DONE' },
      { type: 'WOD_KAN', status: 'DONE' },
    ]
    const result = predictProjectTimeline(apps, [])
    expect(result).toBeNull()
  })

  it('identifies critical path as longest predicted application', () => {
    const apps = [
      { type: 'ZJAZD', status: 'TODO' },
      { type: 'WOD_KAN', status: 'TODO' },
      { type: 'ENERGIA', status: 'TODO' },
    ]
    const result = predictProjectTimeline(apps, [])
    expect(result).not.toBeNull()
    expect(result.criticalApplication).toBeDefined()
    // ZJAZD has the highest legalDays (30) → should be critical
    expect(result.criticalApplication).toBe('ZJAZD')
    expect(result.permitDays).toBe(79) // 65 + 14
    expect(result.totalWithPermit).toBe(result.applicationDays + 79)
  })

  it('excludes DONE applications from critical path', () => {
    const apps = [
      { type: 'ZJAZD', status: 'DONE' },
      { type: 'WOD_KAN', status: 'TODO' },
    ]
    const result = predictProjectTimeline(apps, [])
    expect(result?.criticalApplication).toBe('WOD_KAN')
  })
})
