import { describe, it, expect } from 'vitest'

// URL ↔ tab ID mapping — must match ProjectView.jsx constants
const URL_TO_TAB = {
  client: 'client',
  plot: 'plot',
  applications: 'applications',
  timeline: 'milestones',
}
const TAB_TO_URL = {
  client: 'client',
  plot: 'plot',
  applications: 'applications',
  milestones: 'timeline',
}

function resolveActiveTab(tabParam) {
  return URL_TO_TAB[tabParam] || 'milestones'
}

function tabUrl(projectId, tabId) {
  return `/project/${projectId}/${TAB_TO_URL[tabId]}`
}

describe('URL → active tab resolution', () => {
  it('maps "client" URL segment to client tab', () => {
    expect(resolveActiveTab('client')).toBe('client')
  })

  it('maps "plot" URL segment to plot tab', () => {
    expect(resolveActiveTab('plot')).toBe('plot')
  })

  it('maps "applications" URL segment to applications tab', () => {
    expect(resolveActiveTab('applications')).toBe('applications')
  })

  it('maps "timeline" URL segment to milestones tab', () => {
    expect(resolveActiveTab('timeline')).toBe('milestones')
  })

  it('falls back to milestones for unknown URL segment', () => {
    expect(resolveActiveTab('unknown')).toBe('milestones')
    expect(resolveActiveTab('foo')).toBe('milestones')
    expect(resolveActiveTab('')).toBe('milestones')
  })

  it('falls back to milestones when tab param is undefined (no tab in URL)', () => {
    expect(resolveActiveTab(undefined)).toBe('milestones')
  })
})

describe('Tab ID → URL segment', () => {
  const projectId = 'abc-123'

  it('generates correct URL for client tab', () => {
    expect(tabUrl(projectId, 'client')).toBe('/project/abc-123/client')
  })

  it('generates correct URL for plot tab', () => {
    expect(tabUrl(projectId, 'plot')).toBe('/project/abc-123/plot')
  })

  it('generates correct URL for applications tab', () => {
    expect(tabUrl(projectId, 'applications')).toBe('/project/abc-123/applications')
  })

  it('generates correct URL for timeline tab (milestones ID → timeline slug)', () => {
    expect(tabUrl(projectId, 'milestones')).toBe('/project/abc-123/timeline')
  })
})

describe('URL ↔ tab round-trip', () => {
  it('all tabs survive a round-trip encode/decode', () => {
    const tabIds = Object.keys(TAB_TO_URL)
    for (const tabId of tabIds) {
      const urlSlug = TAB_TO_URL[tabId]
      const resolved = resolveActiveTab(urlSlug)
      expect(resolved).toBe(tabId)
    }
  })

  it('all URL slugs survive a round-trip decode/encode', () => {
    const urlSlugs = Object.keys(URL_TO_TAB)
    for (const slug of urlSlugs) {
      const tabId = URL_TO_TAB[slug]
      const encodedBack = TAB_TO_URL[tabId]
      expect(encodedBack).toBe(slug)
    }
  })
})

describe('Sidebar active path matching', () => {
  function isProjectActive(path, projectId) {
    return path === `/project/${projectId}` || path.startsWith(`/project/${projectId}/`)
  }

  it('matches exact project path (no tab)', () => {
    expect(isProjectActive('/project/abc-123', 'abc-123')).toBe(true)
  })

  it('matches project path with tab', () => {
    expect(isProjectActive('/project/abc-123/timeline', 'abc-123')).toBe(true)
    expect(isProjectActive('/project/abc-123/client', 'abc-123')).toBe(true)
  })

  it('does not match different project', () => {
    expect(isProjectActive('/project/abc-123/timeline', 'abc-456')).toBe(false)
    expect(isProjectActive('/project/abc-123', 'abc-456')).toBe(false)
  })

  it('does not match prefix collision (abc-1 vs abc-10)', () => {
    expect(isProjectActive('/project/abc-10/timeline', 'abc-1')).toBe(false)
    expect(isProjectActive('/project/abc-10', 'abc-1')).toBe(false)
  })
})
