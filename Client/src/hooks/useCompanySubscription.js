/**
 * Custom hook for synchronized company/subscription state
 * Combines AuthContext with subscription sync for real-time updates
 */
import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import subscriptionSync from '../utils/subscriptionSync'

export const useCompanySubscription = () => {
  const authContext = useContext(AuthContext)
  const [company, setCompany] = useState(null)
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false)
  const [isTrialActive, setIsTrialActive] = useState(false)

  useEffect(() => {
    // Initialize from AuthContext
    if (authContext?.company) {
      setCompany(authContext.company)
      setIsSubscriptionActive(subscriptionSync.isSubscriptionActive(authContext.company))
      setIsTrialActive(subscriptionSync.isTrialActive(authContext.company))
    }

    // Subscribe to subscription changes
    const unsubscribe = subscriptionSync.subscribe((companyData) => {
      setCompany(companyData)
      setIsSubscriptionActive(subscriptionSync.isSubscriptionActive(companyData))
      setIsTrialActive(subscriptionSync.isTrialActive(companyData))
    })

    return () => {
      unsubscribe()
    }
  }, [authContext?.company])

  return {
    company,
    isSubscriptionActive,
    isTrialActive,
    hasAccess: subscriptionSync.hasAccess(company),
    currentPlan: subscriptionSync.getCurrentPlan(company),
  }
}

export default useCompanySubscription
