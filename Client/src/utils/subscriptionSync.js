/**
 * Subscription State Synchronization Utility
 * Manages real-time updates to subscription state across the application
 */

// Global event emitter for subscription changes
const subscriptionListeners = new Set()

export const subscriptionSync = {
  /**
   * Listen for subscription state changes
   * Returns unsubscribe function
   */
  subscribe: (callback) => {
    subscriptionListeners.add(callback)
    // Return unsubscribe function
    return () => {
      subscriptionListeners.delete(callback)
    }
  },

  /**
   * Notify all listeners of subscription state change
   * Called when subscription is updated (payment success, etc.)
   */
  notifySubscriptionChanged: (companyData) => {
    // Update localStorage
    if (companyData) {
      localStorage.setItem('company', JSON.stringify(companyData))
    }
    
    // Notify all listeners
    subscriptionListeners.forEach((callback) => {
      try {
        callback(companyData)
      } catch (error) {
        console.error('Error in subscription listener:', error)
      }
    })
  },

  /**
   * Force refresh subscription data from localStorage
   */
  getLatestCompanyData: () => {
    try {
      const company = localStorage.getItem('company')
      return company ? JSON.parse(company) : null
    } catch (error) {
      console.error('Error parsing company data:', error)
      return null
    }
  },

  /**
   * Check if subscription is active
   */
  isSubscriptionActive: (companyData) => {
    if (!companyData) return false
    
    // If subscription is active, it's active
    if (companyData.isSubscriptionActive && companyData.subscriptionEndDate) {
      const endDate = new Date(companyData.subscriptionEndDate)
      const today = new Date()
      return today < endDate
    }
    
    return false
  },

  /**
   * Check if trial is still active
   */
  isTrialActive: (companyData) => {
    if (!companyData) return false
    
    if (companyData.isTrialActive && companyData.trialEndDate) {
      const endDate = new Date(companyData.trialEndDate)
      const today = new Date()
      return today < endDate
    }
    
    return false
  },

  /**
   * Check if user has access (trial OR active subscription)
   */
  hasAccess: (companyData) => {
    if (!companyData) return false
    return subscriptionSync.isTrialActive(companyData) || subscriptionSync.isSubscriptionActive(companyData)
  },

  /**
   * Get days remaining in trial
   */
  getTrialDaysRemaining: (companyData) => {
    if (!companyData?.trialEndDate) return 0
    
    const trialEndDate = new Date(companyData.trialEndDate)
    const today = new Date()
    const daysRemaining = Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24))
    
    return Math.max(0, daysRemaining)
  },

  /**
   * Get subscription end date
   */
  getSubscriptionEndDate: (companyData) => {
    if (!companyData?.subscriptionEndDate) return null
    return new Date(companyData.subscriptionEndDate)
  },

  /**
   * Get current plan
   */
  getCurrentPlan: (companyData) => {
    if (!companyData) return 'free'
    
    // If subscription is active, return the plan
    if (subscriptionSync.isSubscriptionActive(companyData)) {
      return companyData.plan || 'free'
    }
    
    // If trial is active, return free/trial
    if (subscriptionSync.isTrialActive(companyData)) {
      return 'trial'
    }
    
    return 'free'
  },
}

export default subscriptionSync
