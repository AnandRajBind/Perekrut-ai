import { useEffect, useState } from 'react'
import subscriptionSync from '../utils/subscriptionSync'

export const useTrialStatus = () => {
  const [trialData, setTrialData] = useState({
    isActive: false,
    daysRemaining: 0,
    isExpired: false,
    trialEndDate: null,
    trialStartDate: null,
    isSubscriptionActive: false,
    currentPlan: 'free',
  })

  const updateTrialStatus = (companyData) => {
    if (!companyData) {
      setTrialData({
        isActive: false,
        daysRemaining: 0,
        isExpired: true,
        trialEndDate: null,
        trialStartDate: null,
        isSubscriptionActive: false,
        currentPlan: 'free',
      })
      return
    }

    try {
      const trialStartDate = new Date(companyData.trialStartDate)
      const trialEndDate = new Date(companyData.trialEndDate)
      const today = new Date()
      
      // Calculate days remaining
      const daysRemaining = Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24))
      
      // Check if subscription is active
      const isSubscriptionActive = subscriptionSync.isSubscriptionActive(companyData)
      
      // Trial is only expired if no subscription AND trial is past end date
      const isActive = companyData.isTrialActive && today < trialEndDate && !isSubscriptionActive
      const isExpired = !isActive && !isSubscriptionActive && daysRemaining <= 0
      
      // Get current plan
      const currentPlan = subscriptionSync.getCurrentPlan(companyData)

      setTrialData({
        isActive,
        daysRemaining: Math.max(0, daysRemaining),
        isExpired,
        trialEndDate,
        trialStartDate,
        isSubscriptionActive,
        currentPlan,
      })
    } catch (error) {
      console.error('Error parsing company data:', error)
      setTrialData({
        isActive: false,
        daysRemaining: 0,
        isExpired: true,
        trialEndDate: null,
        trialStartDate: null,
        isSubscriptionActive: false,
        currentPlan: 'free',
      })
    }
  }

  useEffect(() => {
    // Initial load from localStorage
    const company = subscriptionSync.getLatestCompanyData()
    updateTrialStatus(company)

    // Subscribe to subscription changes
    const unsubscribe = subscriptionSync.subscribe((companyData) => {
      updateTrialStatus(companyData)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return trialData
}
