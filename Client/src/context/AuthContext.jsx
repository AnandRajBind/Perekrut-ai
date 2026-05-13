import React, { createContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'
import subscriptionSync from '../utils/subscriptionSync'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedCompany = localStorage.getItem('company')
    const token = localStorage.getItem('token')

    if (storedCompany && token) {
      try {
        setCompany(JSON.parse(storedCompany))
      } catch (err) {
        localStorage.removeItem('company')
        localStorage.removeItem('token')
      }
    }
    setLoading(false)
  }, [])

  // Subscribe to subscription changes to keep company state in sync
  useEffect(() => {
    const unsubscribe = subscriptionSync.subscribe((companyData) => {
      if (companyData) {
        setCompany(companyData)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const register = useCallback(async (name, email, password, confirmPassword, companyName, industry) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authService.register({ name, email, password, confirmPassword, companyName, industry })
      const { data } = response

      localStorage.setItem('token', data.token)
      localStorage.setItem('company', JSON.stringify(data.company))
      setCompany(data.company)

      return { success: true, data }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Registration failed'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await authService.login({ email, password })
      const { data } = response

      localStorage.setItem('token', data.token)
      localStorage.setItem('company', JSON.stringify(data.company))
      localStorage.setItem('trialStatus', JSON.stringify(data.trialStatus || {}))
      setCompany(data.company)

      return { success: true, data }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Login failed'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('company')
    localStorage.removeItem('trialStatus')
    setCompany(null)
    setError(null)
  }, [])

  const updateCompany = useCallback((updatedCompanyData) => {
    if (updatedCompanyData) {
      localStorage.setItem('company', JSON.stringify(updatedCompanyData))
      setCompany(updatedCompanyData)
      // Notify subscription sync listeners
      subscriptionSync.notifySubscriptionChanged(updatedCompanyData)
    }
  }, [])

  const isAuthenticated = !!company

  return (
    <AuthContext.Provider
      value={{
        company,
        loading,
        error,
        register,
        login,
        logout,
        updateCompany,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

