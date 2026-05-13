import React, { useState, useEffect } from 'react'
import { Check, Calendar, AlertCircle, CreditCard } from 'lucide-react'
import { toast } from 'react-toastify'
import AdminLayout from '../components/AdminLayout'
import subscriptionSync from '../utils/subscriptionSync'
import {
  loadRazorpayScript,
  createPaymentOrder,
  initiateRazorpayPayment,
  verifyPaymentSignature,
  getPaymentHistory,
} from '../utils/razorpayIntegration'

const AdminBilling = () => {
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)

  useEffect(() => {
    fetchCompanyData()
    loadPaymentGateway()

    // Subscribe to subscription changes
    const unsubscribe = subscriptionSync.subscribe((companyData) => {
      if (companyData) {
        setCompany(companyData)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const fetchCompanyData = async () => {
    try {
      const companyData = subscriptionSync.getLatestCompanyData()
      if (companyData) {
        setCompany(companyData)
      }
    } catch (error) {
      toast.error('Failed to load billing information', {
        position: 'top-right',
        autoClose: 3000,
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentGateway = async () => {
    const isLoaded = await loadRazorpayScript()
    if (!isLoaded) {
      console.warn('Razorpay script failed to load')
    }
  }

  const fetchPaymentHistory = async () => {
    if (!localStorage.getItem('token')) return

    setHistoryLoading(true)
    try {
      const data = await getPaymentHistory(1, 10, localStorage.getItem('token'))
      setPaymentHistory(data.payments || [])
    } catch (error) {
      toast.error('Failed to load payment history', {
        position: 'top-right',
        autoClose: 3000,
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const calculateTrialDaysRemaining = () => {
    if (!company?.trialEndDate) return 0
    const endDate = new Date(company.trialEndDate)
    const today = new Date()
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
    return Math.max(0, daysRemaining)
  }

  const isTrialActive = () => {
    if (!company) return false
    const today = new Date()
    const endDate = new Date(company.trialEndDate)
    return today < endDate && company.isTrialActive
  }

  const isSubscriptionActive = () => {
    return subscriptionSync.isSubscriptionActive(company)
  }

  const handlePlanSelect = async (planId, planName) => {
    if (!company || !localStorage.getItem('token')) return

    setProcessingPlan(planId)

    try {
      // Step 1: Create payment order
      const token = localStorage.getItem('token')
      toast.info('Creating payment order...', { autoClose: 2000 })

      const orderData = await createPaymentOrder(planId, token)

      // Step 2: Open Razorpay checkout
      const onPaymentSuccess = async (paymentData) => {
        try {
          toast.info('Verifying payment...', { autoClose: 2000 })

          // Step 3: Verify payment with backend
          const result = await verifyPaymentSignature(paymentData, token)

          // Step 4: Update company data and notify all subscribers
          if (result.company) {
            // This will update localStorage and notify all listeners
            subscriptionSync.notifySubscriptionChanged(result.company)
          }

          toast.success(`Successfully upgraded to ${planName} plan! 🎉`, {
            position: 'top-right',
            autoClose: 3000,
          })

          setProcessingPlan(null)

          // Refresh payment history
          if (showPaymentHistory) {
            fetchPaymentHistory()
          }
        } catch (error) {
          console.error('Payment verification error:', error)
          toast.error(error.message || 'Payment verification failed. Please contact support.', {
            position: 'top-right',
            autoClose: 3000,
          })
          setProcessingPlan(null)
        }
      }

      const onPaymentError = (errorMessage) => {
        console.error('Payment error:', errorMessage)
        toast.error(`Payment failed: ${errorMessage}`, {
          position: 'top-right',
          autoClose: 3000,
        })
        setProcessingPlan(null)
      }

      // Open Razorpay checkout
      await initiateRazorpayPayment(
        orderData.orderId,
        orderData.amount,
        orderData.keyId,
        company.email,
        onPaymentSuccess,
        onPaymentError
      )
    } catch (error) {
      console.error('Plan upgrade error:', error)
      toast.error(error.message || 'Failed to process payment. Please try again.', {
        position: 'top-right',
        autoClose: 3000,
      })
      setProcessingPlan(null)
    }
  }

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '₹4,999',
      period: 'month',
      description: 'Perfect for small teams',
      features: [
        'Up to 5 interview templates',
        'Basic candidate evaluation',
        'Email support',
        'Manual interview scheduling',
      ],
      cta: 'Select Plan',
      highlighted: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '₹14,999',
      period: 'month',
      description: 'For growing companies',
      features: [
        'Unlimited interview templates',
        'Advanced AI evaluations',
        'Priority support',
        'Interview library access',
        'Team collaboration tools',
        'Export & reports',
      ],
      cta: 'Select Plan',
      highlighted: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '₹29,999',
      period: 'month',
      description: 'For large organizations',
      features: [
        'Everything in Professional',
        'Advanced analytics & insights',
        'Unlimited team members',
        'Custom branding options',
        'API access',
        'Video interview recordings',
        'Advanced reporting tools',
        'Dedicated support',
      ],
      cta: 'Select Plan',
      highlighted: false,
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="text-gray-600 mt-1">Manage your subscription and billing information</p>
        </div>

        {/* Current Plan */}
        {company && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Current Plan</h2>
                <p className="text-gray-600 mt-1">
                  You are currently on the <span className="font-semibold">
                    {isSubscriptionActive() ? company.plan : company.plan || 'Trial'}
                  </span> plan
                </p>
              </div>
              {isSubscriptionActive() && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <Check className="text-green-600" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-green-900">Subscription Active</p>
                    <p className="text-xs text-green-700">
                      Until {new Date(company.subscriptionEndDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {isTrialActive() && !isSubscriptionActive() && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="text-yellow-600" size={20} />
                  <div>
                    <p className="text-sm font-semibold text-yellow-900">Trial Active</p>
                    <p className="text-xs text-yellow-700">
                      {calculateTrialDaysRemaining()} days remaining
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Trial Info */}
            {isTrialActive() && !isSubscriptionActive() && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium mb-1">Trial Start</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {company.trialStartDate
                        ? new Date(company.trialStartDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium mb-1">Trial End</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {company.trialEndDate
                        ? new Date(company.trialEndDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 uppercase font-medium mb-1">Days Remaining</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {calculateTrialDaysRemaining()} days
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{
                        width: `${Math.max(
                          0,
                          (calculateTrialDaysRemaining() / 3) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-600 mt-3">
                  Your 3-day trial will expire soon. Upgrade to a paid plan to continue using Perekrut AI.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Upgrade Prompt */}
        {isTrialActive() && !isSubscriptionActive() && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to unlock full potential?</h3>
                <p className="text-gray-600">
                  Upgrade your plan to get access to advanced features and unlimited interviews.
                </p>
              </div>
              <button
                onClick={() => handlePlanSelect('professional', 'Professional')}
                disabled={processingPlan === 'professional'}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium whitespace-nowrap disabled:opacity-50"
              >
                {processingPlan === 'professional' ? 'Processing...' : 'Upgrade Now'}
              </button>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Plan</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-lg border transition relative overflow-hidden ${
                  plan.highlighted
                    ? 'border-primary shadow-lg'
                    : 'border-gray-200 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Highlighted Badge */}
                {plan.highlighted && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-purple-600 text-white py-1 px-4 text-center text-sm font-medium">
                    Most Popular
                  </div>
                )}

                <div
                  className={`p-6 md:p-8 ${
                    plan.highlighted ? 'bg-gradient-to-br from-primary/5 to-purple-50' : 'bg-white'
                  }`}
                >
                  {/* Top padding for highlighted */}
                  {plan.highlighted && <div className="h-8" />}

                  {/* Plan Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600 ml-2">/ {plan.period}</span>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handlePlanSelect(plan.id, plan.name)}
                    disabled={processingPlan === plan.id || (company?.plan === plan.id && isSubscriptionActive())}
                    className={`w-full py-3 rounded-lg font-medium transition mb-6 ${
                      company?.plan === plan.id && isSubscriptionActive()
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : plan.highlighted
                        ? 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
                        : 'border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-50'
                    } ${processingPlan === plan.id ? 'cursor-wait' : ''}`}
                  >
                    {processingPlan === plan.id
                      ? 'Processing...'
                      : company?.plan === plan.id && isSubscriptionActive()
                      ? '✓ Current Plan'
                      : plan.cta}
                  </button>

                  {/* Features */}
                  <div className="space-y-3 border-t border-gray-200 pt-6">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Check className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CreditCard className="text-primary" size={24} />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
                <p className="text-sm text-gray-600">View your transaction history</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowPaymentHistory(!showPaymentHistory)
                if (!showPaymentHistory) {
                  fetchPaymentHistory()
                }
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium text-sm"
            >
              {showPaymentHistory ? 'Hide History' : 'View History'}
            </button>
          </div>

          {showPaymentHistory && (
            <>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : paymentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                          Date
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                          Plan
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                          Amount
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900 text-sm">
                          Order ID
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((payment) => (
                        <tr key={payment._id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-700">
                            {payment.paymentDate
                              ? new Date(payment.paymentDate).toLocaleDateString()
                              : new Date(payment.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">
                            {payment.planName}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            ₹{(payment.amount / 100).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                payment.status === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : payment.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : payment.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                            {payment.razorpayOrderId.substring(0, 12)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No payment history found</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>

          <div className="space-y-6">
            {[
              {
                q: 'Can I change my plan anytime?',
                a: 'Yes, you can upgrade or downgrade your plan anytime. Changes will take effect at the start of your next billing cycle.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards (Visa, Mastercard, American Express) and bank transfers for enterprise customers.',
              },
              {
                q: 'Is there a contract required?',
                a: 'No, all our plans are month-to-month with no long-term commitments. Cancel anytime.',
              },
              {
                q: 'Do you offer discounts for annual billing?',
                a: 'Yes! Contact our sales team for special pricing on annual subscriptions.',
              },
            ].map((faq, i) => (
              <div key={i}>
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Support */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 md:p-8 border border-gray-200 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Questions about our plans?</h3>
          <p className="text-gray-600 mb-4">Our sales team is happy to help you choose the right plan.</p>
          <a
            href="mailto:sales@perekrut.ai"
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90 transition font-medium"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminBilling
