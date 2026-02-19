import { Routes, Route } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import ProjectView from './pages/ProjectView'
import Analytics from './pages/Analytics'
import MpzpFailures from './pages/MpzpFailures'
import { db } from './lib/database'

export default function App() {
  const [projects, setProjects] = useState([])
  const [historicalData, setHistoricalData] = useState([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [projRes, histRes] = await Promise.all([
      db.getProjects(),
      db.getHistoricalData(),
    ])
    setProjects(projRes.data || [])
    setHistoricalData(histRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const refreshProjects = useCallback(async () => {
    const { data } = await db.getProjects()
    setProjects(data || [])
    const { data: hist } = await db.getHistoricalData()
    setHistoricalData(hist || [])
  }, [])

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        projects={projects}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
        <div className="max-w-5xl mx-auto px-4 py-5 md:px-8 md:py-7">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  projects={projects}
                  historicalData={historicalData}
                  loading={loading}
                  onMenuOpen={() => setSidebarOpen(true)}
                />
              }
            />
            <Route
              path="/new"
              element={<NewProject onCreated={refreshProjects} onMenuOpen={() => setSidebarOpen(true)} />}
            />
            <Route
              path="/project/:id/:tab?"
              element={
                <ProjectView
                  projects={projects}
                  historicalData={historicalData}
                  onUpdated={refreshProjects}
                  onMenuOpen={() => setSidebarOpen(true)}
                />
              }
            />
            <Route
              path="/analytics"
              element={
                <Analytics
                  projects={projects}
                  historicalData={historicalData}
                  onMenuOpen={() => setSidebarOpen(true)}
                />
              }
            />
            <Route
              path="/mpzp-failures"
              element={<MpzpFailures onRetried={refreshProjects} onMenuOpen={() => setSidebarOpen(true)} />}
            />
          </Routes>
        </div>
      </main>
    </div>
  )
}
