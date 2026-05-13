import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, FileText, TrendingUp, ArrowRight, Lock } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import StatsCard from '../components/StatsCard'
import TrialBanner from '../components/TrialBanner'
import { useTrialStatus } from '../hooks/useTrialStatus'
import subscriptionSync from '../utils/subscriptionSync'

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalInterviews: 0,
    candidatesInterviewed: 0,
    averageScore: 0,
  })
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)
  const { isExpired, isSubscriptionActive } = useTrialStatus()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token')
        
        if (!token) {
          console.warn('No authentication token found')
          setLoading(false)
          return
        }

        // ===== PRODUCTION READINESS: Force fresh data (no caching) =====
        // Fetch interviews with cache-busting timestamp
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9000/api'
        const response = await fetch(`${apiUrl}/interviews?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        const interviewsData = data.data?.interviews || []

        // Calculate statistics
        const completed = interviewsData.filter((i) => i.status === 'completed')
        const totalScore = completed.reduce((sum, i) => sum + (i.evaluation?.score || 0), 0)
        const avgScore = completed.length > 0 ? (totalScore / completed.length).toFixed(1) : 0

        setStats({
          totalInterviews: interviewsData.length,
          candidatesInterviewed: new Set(interviewsData.map((i) => i.candidateEmail || i.candidateId)).size,
          averageScore: avgScore,
        })

        // Get recent interviews (both authenticated and public template-based)
        setInterviews(interviewsData.slice(0, 5))
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    // ===== PRODUCTION READINESS: Auto-refresh dashboard every 30 seconds =====
    fetchDashboardData()

    // Auto-refresh interval
    const refreshInterval = setInterval(fetchDashboardData, 30000) // 30 seconds

    return () => clearInterval(refreshInterval)
  }, [refreshTrigger])

  // Subscribe to subscription changes to refetch data
  useEffect(() => {
    const unsubscribe = subscriptionSync.subscribe(() => {
      setLoading(true)
      // Trigger a refetch by updating the refresh trigger
      setRefreshTrigger((prev) => prev + 1)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Trial Banner */}
        <TrialBanner />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome to your company interview dashboard</p>
          </div>
          {isExpired && !isSubscriptionActive ? (
            <Link
              to="/dashboard/billing"
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 transition font-medium"
            >
              <Lock size={18} />
              <span>Upgrade Plan</span>
            </Link>
          ) : (
            <Link
              to="/dashboard/create-interview"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90 transition font-medium"
            >
              <span>Create Interview</span>
              <ArrowRight size={18} />
            </Link>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Total Interviews"
            value={stats.totalInterviews}
            icon={<FileText className="text-blue-600" />}
            trend="This month"
          />
          <StatsCard
            title="Candidates"
            value={stats.candidatesInterviewed}
            icon={<Users className="text-green-600" />}
            trend="Unique candidates"
          />
          <StatsCard
            title="Average Score"
            value={`${stats.averageScore}%`}
            icon={<TrendingUp className="text-purple-600" />}
            trend="From evaluations"
          />
        </div>

        {/* Recent Interviews */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Recent Interviews</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : interviews.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No interviews yet. <br />
              {isExpired && !isSubscriptionActive ? (
                <Link
                  to="/dashboard/billing"
                  className="text-red-600 hover:underline font-medium"
                >
                  Upgrade your plan to create interviews
                </Link>
              ) : (
                <Link
                  to="/dashboard/create-interview"
                  className="text-primary hover:underline"
                >
                  Create your first interview template
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Score</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((interview) => (
                    <tr
                      key={interview._id}
                      className="border-t border-gray-200 hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">{interview.jobRole || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{interview.interviewType || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            interview.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : interview.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {interview.status?.charAt(0).toUpperCase() + interview.status?.slice(1) || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {interview.status === 'completed' && interview.evaluation?.score !== null && interview.evaluation?.score !== undefined
                          ? `${interview.evaluation.score}%`
                          : interview.status === 'completed'
                          ? '⚠ No Score' // Completed but no evaluation
                          : '—'
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {interview.createdAt
                          ? new Date(interview.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <Link
              to="/dashboard/interviews"
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              View all interviews →
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`rounded-lg p-6 border transition ${
            isExpired && !isSubscriptionActive
              ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 opacity-75'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
          }`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Interview Templates</h3>
            <p className="text-gray-600 text-sm mb-4">
              Create reusable interview templates for different roles and levels
            </p>
            {isExpired && !isSubscriptionActive ? (
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-red-600" />
                <Link
                  to="/dashboard/billing"
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Upgrade to create templates →
                </Link>
              </div>
            ) : (
              <Link
                to="/dashboard/create-interview"
                className="text-primary hover:text-primary/80 text-sm font-medium"
              >
                Manage templates →
              </Link>
            )}
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">View Results</h3>
            <p className="text-gray-600 text-sm mb-4">
              Analyze candidate performance and detailed evaluations
            </p>
            <Link
              to="/dashboard/results"
              className="text-primary hover:text-primary/80 text-sm font-medium"
            >
              View results →
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard
