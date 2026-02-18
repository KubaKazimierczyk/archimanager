import { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/database'

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const { data, error } = await db.getProjects()
    if (error) setError(error)
    else setProjects(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  return { projects, loading, error, refetch: fetchProjects, setProjects }
}

export function useProject(id) {
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProject = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data } = await db.getProject(id)
    setProject(data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchProject() }, [fetchProject])

  return { project, loading, refetch: fetchProject, setProject }
}

export function useHistoricalData() {
  const [data, setData] = useState([])

  useEffect(() => {
    db.getHistoricalData().then(({ data }) => setData(data || []))
  }, [])

  const refetch = useCallback(async () => {
    const { data } = await db.getHistoricalData()
    setData(data || [])
  }, [])

  return { historicalData: data, refetch }
}
