import { Routes, Route } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import ProjectView from './pages/ProjectView'
import Analytics from './pages/Analytics'
import { db } from './lib/database'

export default function App() {
  const [projects, setProjects] = useState([])
  const [historicalData, setHistoricalData] = useState([])
  const [loading, setLoading] = useState(true)

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
      <Sidebar projects={projects} />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-5xl mx-auto px-8 py-7">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  projects={projects}
                  historicalData={historicalData}
                  loading={loading}
                />
              }
            />
            <Route
              path="/new"
              element={<NewProject onCreated={refreshProjects} />}
            />
            <Route
              path="/project/:id"
              element={
                <ProjectView
                  projects={projects}
                  historicalData={historicalData}
                  onUpdated={refreshProjects}
                />
              }
            />
            <Route
              path="/analytics"
              element={
                <Analytics
                  projects={projects}
                  historicalData={historicalData}
                />
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  )
}
