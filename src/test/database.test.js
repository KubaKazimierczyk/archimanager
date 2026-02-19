import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase module so demo mode is always used
vi.mock('../lib/supabase', () => ({
  supabase: {},
  isSupabaseConfigured: () => false,
}))

// Import after mocking
const { db } = await import('../lib/database')

describe('db.updateApplication — demo mode status transitions', () => {
  let projectId
  let appId

  beforeEach(async () => {
    // Create a fresh demo project for each test
    const { data } = await db.createProject({
      client: { first_name: 'Test', last_name: 'User', city: 'Kraków' },
      plot: { building_type: 'Dom jednorodzinny', road_class: 'Gminna' },
    })
    projectId = data.id
    appId = data.applications[0].id // ZJAZD
  })

  it('sets status WAITING when only filed_date provided', async () => {
    const { data } = await db.updateApplication(projectId, appId, {
      filed_date: '2025-01-01',
      response_date: null,
    })
    const app = data.applications.find(a => a.id === appId)
    expect(app.status).toBe('WAITING')
    expect(app.actual_days).toBeNull()
  })

  it('sets status DONE and computes actual_days when both dates provided', async () => {
    const { data } = await db.updateApplication(projectId, appId, {
      filed_date: '2025-01-01',
      response_date: '2025-01-22',
    })
    const app = data.applications.find(a => a.id === appId)
    expect(app.status).toBe('DONE')
    expect(app.actual_days).toBe(21)
  })

  it('resets status to TODO when both dates cleared', async () => {
    // First set to WAITING
    await db.updateApplication(projectId, appId, {
      filed_date: '2025-01-01',
      response_date: null,
    })
    // Then clear
    const { data } = await db.updateApplication(projectId, appId, {
      filed_date: null,
      response_date: null,
    })
    const app = data.applications.find(a => a.id === appId)
    expect(app.status).toBe('TODO')
    expect(app.actual_days).toBeNull()
  })

  it('sanitizes empty string filed_date to null (resets to TODO)', async () => {
    // Set to WAITING first
    await db.updateApplication(projectId, appId, {
      filed_date: '2025-01-01',
      response_date: null,
    })
    // Clear with empty strings (as sent from form inputs)
    const { data } = await db.updateApplication(projectId, appId, {
      filed_date: '',
      response_date: '',
    })
    const app = data.applications.find(a => a.id === appId)
    expect(app.status).toBe('TODO')
    expect(app.filed_date).toBeFalsy()
    expect(app.actual_days).toBeNull()
  })

  it('sanitizes empty string response_date to null (keeps WAITING)', async () => {
    const { data } = await db.updateApplication(projectId, appId, {
      filed_date: '2025-01-01',
      response_date: '',
    })
    const app = data.applications.find(a => a.id === appId)
    expect(app.status).toBe('WAITING')
    expect(app.actual_days).toBeNull()
  })

  it('actual_days is exact day count between dates', async () => {
    const { data } = await db.updateApplication(projectId, appId, {
      filed_date: '2025-03-01',
      response_date: '2025-04-01',
    })
    const app = data.applications.find(a => a.id === appId)
    expect(app.actual_days).toBe(31)
  })
})

describe('db.getMpzpFailures — filter logic', () => {
  it('returns projects with mpzp_status covered but no file URL', async () => {
    const { data } = await db.getMpzpFailures()
    // Demo data does not include any MPZP failures (demo-p1 has mpzp_file_name but not mpzp_status='covered' + no URL)
    expect(Array.isArray(data)).toBe(true)
  })

  it('result only includes projects missing mpzp_file_url', async () => {
    const { data } = await db.getMpzpFailures()
    for (const p of data) {
      expect(p.plot?.mpzp_status).toBe('covered')
      expect(p.plot?.mpzp_file_url).toBeFalsy()
    }
  })
})

describe('db.createProject — demo mode', () => {
  it('creates project with applications for all 4 types', async () => {
    const { data, error } = await db.createProject({
      client: { first_name: 'Jan', last_name: 'Kowalski', city: 'Warszawa' },
      plot: { building_type: 'Dom jednorodzinny', road_class: 'Gminna' },
    })
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.applications).toHaveLength(4)
    const types = data.applications.map(a => a.type)
    expect(types).toContain('ZJAZD')
    expect(types).toContain('WOD_KAN')
    expect(types).toContain('ENERGIA')
    expect(types).toContain('ADAPTACJA')
  })

  it('creates project with 4 milestones', async () => {
    const { data } = await db.createProject({
      client: { first_name: 'Anna', last_name: 'Nowak', city: 'Kraków' },
      plot: { building_type: 'Dom jednorodzinny' },
    })
    expect(data.milestones).toHaveLength(4)
    // First milestone starts IN_PROGRESS
    expect(data.milestones[0].status).toBe('IN_PROGRESS')
    // Rest start TODO
    expect(data.milestones.slice(1).every(m => m.status === 'TODO')).toBe(true)
  })

  it('generates name from building_type and last_name', async () => {
    const { data } = await db.createProject({
      client: { last_name: 'Wiśniewski' },
      plot: { building_type: 'Budynek usługowy' },
    })
    expect(data.name).toBe('Budynek usługowy — Wiśniewski')
  })
})
