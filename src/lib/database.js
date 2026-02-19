import { supabase, isSupabaseConfigured } from './supabase'
import { APPLICATION_TYPES, MILESTONES } from './constants'

// ─── DEMO DATA (used when Supabase is not configured) ─────
const DEMO_PROJECTS = [
  {
    id: 'demo-p1',
    name: 'Dom jednorodzinny — Kowalski',
    status: 'active',
    created_at: '2025-10-15',
    client: {
      first_name: 'Jan', last_name: 'Kowalski', pesel: '85010112345', nip: '',
      street: 'Lipowa', number: '15', city: 'Piaseczno', postal_code: '05-500',
      province: 'mazowieckie', phone: '601-234-567', email: 'jan.kowalski@email.pl',
      property_title: 'Własność', land_register: 'WA1I/00012345/6',
    },
    plot: {
      number: '123/4', area: 1200, precinct: 'Piaseczno',
      land_register: 'WA1I/00012345/6', road_class: 'Gminna',
      road_name: 'ul. Lipowa', road_plot_number: '300/1',
      building_type: 'Dom jednorodzinny', residents: 4,
      water_demand: '0.8', power_demand: '14',
      has_mpzp: true, mpzp_file_name: 'MPZP_Piaseczno_2023_MN.pdf',
      purpose: 'MN — zabudowa mieszkaniowa jednorodzinna',
      building_coverage: 30, bio_area: 60, intensity: '0.4 - 0.8',
      max_height: 10, roof_angle: '30° - 45°', heritage: false,
      landscape: false, parking: 2, setbacks: '4m od frontu, 3m od bocznych',
    },
    applications: [
      { id: 'a1', type: 'ZJAZD', status: 'DONE', filed_date: '2025-11-01', response_date: '2025-11-22', actual_days: 21, notes: 'Decyzja pozytywna' },
      { id: 'a2', type: 'WOD_KAN', status: 'WAITING', filed_date: '2025-12-10', response_date: null, actual_days: null, notes: '' },
      { id: 'a3', type: 'ENERGIA', status: 'TODO', filed_date: null, response_date: null, actual_days: null, notes: '' },
      { id: 'a4', type: 'ADAPTACJA', status: 'TODO', filed_date: null, response_date: null, actual_days: null, notes: '' },
    ],
    milestones: [
      { id: 'm1', status: 'DONE', completed_date: '2025-10-20' },
      { id: 'm2', status: 'IN_PROGRESS', completed_date: null },
      { id: 'm3', status: 'TODO', completed_date: null },
      { id: 'm4', status: 'TODO', completed_date: null },
    ],
  },
  {
    id: 'demo-p2',
    name: 'Rozbudowa — Nowak',
    status: 'active',
    created_at: '2026-01-10',
    client: {
      first_name: 'Anna', last_name: 'Nowak', pesel: '90050267890', nip: '',
      street: 'Ogrodowa', number: '8A', city: 'Grodzisk Mazowiecki',
      postal_code: '05-825', province: 'mazowieckie', phone: '502-345-678',
      email: 'a.nowak@email.pl', property_title: 'Własność',
      land_register: 'WA1G/00054321/0',
    },
    plot: {
      number: '456/2', area: 850, precinct: 'Grodzisk Maz.',
      land_register: 'WA1G/00054321/0', road_class: 'Gminna',
      road_name: 'ul. Ogrodowa', road_plot_number: '500/3',
      building_type: 'Dom jednorodzinny', residents: 5,
      water_demand: '1.0', power_demand: '17',
      has_mpzp: false, purpose: 'Brak MPZP — wymagane WZ',
    },
    applications: [
      { id: 'a5', type: 'ZJAZD', status: 'IN_PROGRESS', filed_date: '2026-01-20', response_date: null, actual_days: null, notes: '' },
      { id: 'a6', type: 'WOD_KAN', status: 'TODO', filed_date: null, response_date: null, actual_days: null, notes: '' },
      { id: 'a7', type: 'ENERGIA', status: 'TODO', filed_date: null, response_date: null, actual_days: null, notes: '' },
      { id: 'a8', type: 'ADAPTACJA', status: 'TODO', filed_date: null, response_date: null, actual_days: null, notes: '' },
    ],
    milestones: [
      { id: 'm1', status: 'DONE', completed_date: '2026-01-15' },
      { id: 'm2', status: 'IN_PROGRESS', completed_date: null },
      { id: 'm3', status: 'TODO', completed_date: null },
      { id: 'm4', status: 'TODO', completed_date: null },
    ],
  },
]

const DEMO_HISTORICAL = [
  { type: 'ZJAZD', actual_days: 22, municipality: 'Piaseczno' },
  { type: 'ZJAZD', actual_days: 28, municipality: 'Piaseczno' },
  { type: 'ZJAZD', actual_days: 18, municipality: 'Grodzisk Mazowiecki' },
  { type: 'WOD_KAN', actual_days: 15, municipality: 'Piaseczno' },
  { type: 'WOD_KAN', actual_days: 19, municipality: 'Pruszków' },
  { type: 'ENERGIA', actual_days: 14, municipality: 'Piaseczno' },
  { type: 'ENERGIA', actual_days: 20, municipality: 'Grodzisk Mazowiecki' },
  { type: 'ENERGIA', actual_days: 18, municipality: 'Pruszków' },
]

// ─── IN-MEMORY STATE (demo mode) ──────────────────────────
let demoProjects = [...DEMO_PROJECTS]
let demoHistorical = [...DEMO_HISTORICAL]

// ─── DATABASE SERVICE ─────────────────────────────────────

export const db = {
  // ── Projects ──────────────────────────────────────────
  async getProjects() {
    if (!isSupabaseConfigured()) {
      return { data: demoProjects, error: null }
    }
    const { data, error } = await supabase
      .from('projects')
      .select('*, applications(*), milestones(*)')
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async getProject(id) {
    if (!isSupabaseConfigured()) {
      const project = demoProjects.find(p => p.id === id)
      return { data: project || null, error: project ? null : 'Not found' }
    }
    const { data, error } = await supabase
      .from('projects')
      .select('*, applications(*), milestones(*)')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async createProject(projectData) {
    if (!isSupabaseConfigured()) {
      const id = `demo-${Date.now()}`
      const newProject = {
        id,
        name: `${projectData.plot.building_type || 'Projekt'} — ${projectData.client.last_name}`,
        status: 'active',
        created_at: new Date().toISOString().split('T')[0],
        client: projectData.client,
        plot: projectData.plot,
        applications: Object.keys(APPLICATION_TYPES).map((key, i) => ({
          id: `${id}-a${i}`,
          type: key,
          status: 'TODO',
          filed_date: null,
          response_date: null,
          actual_days: null,
          notes: '',
        })),
        milestones: MILESTONES.map((m, i) => ({
          id: m.id,
          status: i === 0 ? 'IN_PROGRESS' : 'TODO',
          completed_date: null,
        })),
      }
      demoProjects = [newProject, ...demoProjects]
      return { data: newProject, error: null }
    }

    // Supabase: insert project, then applications and milestones
    const { data: project, error: projError } = await supabase
      .from('projects')
      .insert({
        name: `${projectData.plot.building_type || 'Projekt'} — ${projectData.client.last_name}`,
        status: 'active',
        client: projectData.client,
        plot: projectData.plot,
      })
      .select()
      .single()

    if (projError) return { data: null, error: projError }

    // Insert applications
    const apps = Object.keys(APPLICATION_TYPES).map(key => ({
      project_id: project.id,
      type: key,
      status: 'TODO',
    }))
    await supabase.from('applications').insert(apps)

    // Insert milestones
    const ms = MILESTONES.map((m, i) => ({
      project_id: project.id,
      milestone_id: m.id,
      status: i === 0 ? 'IN_PROGRESS' : 'TODO',
    }))
    await supabase.from('milestones').insert(ms)

    return db.getProject(project.id)
  },

  async updateProject(id, updates) {
    if (!isSupabaseConfigured()) {
      demoProjects = demoProjects.map(p => p.id === id ? { ...p, ...updates } : p)
      return { data: demoProjects.find(p => p.id === id), error: null }
    }
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  // ── Applications ──────────────────────────────────────
  async updateApplication(projectId, appId, updates) {
    if (!isSupabaseConfigured()) {
      demoProjects = demoProjects.map(p => {
        if (p.id !== projectId) return p
        return {
          ...p,
          applications: p.applications.map(a => {
            if (a.id !== appId) return a
            const updated = { ...a, ...updates }
            // Auto-compute
            if (updated.filed_date && updated.response_date) {
              updated.actual_days = Math.floor(
                (new Date(updated.response_date) - new Date(updated.filed_date)) / 864e5
              )
              updated.status = 'DONE'
              // Add to historical data for ML
              const type = APPLICATION_TYPES[updated.type]
              if (type) {
                demoHistorical.push({
                  type: updated.type,
                  actual_days: updated.actual_days,
                  municipality: p.client?.city || '',
                })
              }
            } else if (updated.filed_date) {
              updated.status = 'WAITING'
            }
            return updated
          }),
        }
      })
      return { data: demoProjects.find(p => p.id === projectId), error: null }
    }
    const { data, error } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', appId)
      .select()
      .single()
    return { data, error }
  },

  // ── Milestones ────────────────────────────────────────
  async updateMilestone(projectId, milestoneId, updates) {
    if (!isSupabaseConfigured()) {
      demoProjects = demoProjects.map(p => {
        if (p.id !== projectId) return p
        return {
          ...p,
          milestones: p.milestones.map(m =>
            m.id === milestoneId ? { ...m, ...updates } : m
          ),
        }
      })
      return { data: demoProjects.find(p => p.id === projectId), error: null }
    }
    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('project_id', projectId)
      .eq('milestone_id', milestoneId)
      .select()
      .single()
    return { data, error }
  },

  // ── Historical data (for ML) ──────────────────────────
  async getHistoricalData() {
    if (!isSupabaseConfigured()) {
      return {
        data: demoHistorical.map(h => ({
          type: h.type,
          actualDays: h.actual_days,
          municipality: h.municipality,
        })),
        error: null,
      }
    }
    const { data, error } = await supabase
      .from('application_history')
      .select('*')
      .order('created_at', { ascending: false })
    return {
      data: (data || []).map(h => ({
        type: h.type,
        actualDays: h.actual_days,
        municipality: h.municipality,
      })),
      error,
    }
  },

  // ── MPZP File Storage ─────────────────────────────────
  async uploadMpzpFile(projectId, file) {
    if (!isSupabaseConfigured()) {
      return { data: { path: `mpzp/${projectId}/${file.name}`, name: file.name }, error: null }
    }
    const path = `mpzp/${projectId}/${file.name}`
    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(path, file, { upsert: true })
    return { data: data ? { path, name: file.name } : null, error }
  },

  async getMpzpFileUrl(path) {
    if (!isSupabaseConfigured()) return { data: null }
    const { data } = supabase.storage.from('project-files').getPublicUrl(path)
    return { data: data?.publicUrl || null }
  },

  // ── MPZP AI Analysis ──────────────────────────────────
  async analyzeMpzpFile(pdfUrl) {
    if (!isSupabaseConfigured()) return { data: null, error: 'Demo mode — Supabase not configured' }
    const { data, error } = await supabase.functions.invoke('mpzp-analyze', {
      body: { pdfUrl, action: 'extract' },
    })
    return { data, error }
  },

  async chatMpzpFile(pdfUrl, question, plotData) {
    if (!isSupabaseConfigured()) return { data: null, error: 'Demo mode — Supabase not configured' }
    const { data, error } = await supabase.functions.invoke('mpzp-analyze', {
      body: { pdfUrl, action: 'chat', question, plotData },
    })
    return { data, error }
  },
}
