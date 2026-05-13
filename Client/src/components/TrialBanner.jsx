import React from 'react'
import { AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTrialStatus } from '../hooks/useTrialStatus'

const TrialBanner = () => {
  const { isActive, daysRemaining, isExpired, isSubscriptionActive, currentPlan } = useTrialStatus()

  // Hide banner if subscription is active (regardless of trial status)
  if (isSubscriptionActive) {
    return null
  }

  // Show expired banner
  if (isExpired) {
    return (
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-4 md:p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <AlertCircle size={24} className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">Trial Period Expired</h3>
            <p className="text-red-100 mb-4">
              Your 3-day free trial has ended. Please upgrade your plan to continue using Perekrut AI.
            </p>
            <Link
              to="/dashboard/billing"
              className="inline-flex items-center gap-2 bg-white text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-50 transition"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show ending soon banner (less than 1 day remaining)
  if (isActive && daysRemaining <= 1 && daysRemaining > 0) {
    return (
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-4 md:p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <Clock size={24} className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">Trial Ending Soon!</h3>
            <p className="text-orange-100 mb-4">
              Your trial expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. Upgrade now to avoid service interruption.
            </p>
            <Link
              to="/dashboard/billing"
              className="inline-flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-orange-50 transition"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show active trial banner (2-3 days remaining)
  if (isActive && daysRemaining > 1) {
    return (
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg p-4 md:p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <CheckCircle size={24} className="flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">Free Trial Active</h3>
            <p className="text-yellow-100 mb-4">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining in your trial. Start your journey with Perekrut AI!
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-yellow-400 rounded-full h-2">
                <div
                  className="bg-yellow-700 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((3 - daysRemaining) / 3) * 100}%` }}
                />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">{daysRemaining}/3 days</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default TrialBanner
