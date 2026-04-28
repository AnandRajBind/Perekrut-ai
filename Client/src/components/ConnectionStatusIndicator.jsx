import React, { useEffect, useState } from 'react'

/**
 * ConnectionStatusIndicator
 * Real-time internet connection status display
 * Shows quality and latency information
 */
export default function ConnectionStatusIndicator({ 
  internetStatus = 'checking',
  lastPingMs = null,
  isCompact = false 
}) {
  const [displayMessage, setDisplayMessage] = useState('Checking...')
  const [statusColor, setStatusColor] = useState('bg-yellow-100')
  const [statusIcon, setStatusIcon] = useState('⏳')

  useEffect(() => {
    const updateDisplay = () => {
      switch (internetStatus) {
        case 'offline':
          setStatusIcon('✗')
          setStatusColor('bg-red-100')
          setDisplayMessage('No Internet Connection')
          break
          
        case 'checking':
          setStatusIcon('⏳')
          setStatusColor('bg-yellow-100')
          setDisplayMessage('Checking Connection...')
          break
          
        case 'good':
          setStatusIcon('✓')
          setStatusColor('bg-green-100')
          setDisplayMessage(`Good Connection${lastPingMs ? ` (${lastPingMs}ms)` : ''}`)
          break
          
        case 'average':
          setStatusIcon('⚠')
          setStatusColor('bg-yellow-100')
          setDisplayMessage(`Average Connection${lastPingMs ? ` (${lastPingMs}ms)` : ''}`)
          break
          
        case 'slow':
          setStatusIcon('⚠')
          setStatusColor('bg-orange-100')
          setDisplayMessage(`Slow Connection${lastPingMs ? ` (${lastPingMs}ms)` : ''}`)
          break
          
        case 'poor':
          setStatusIcon('⚠')
          setStatusColor('bg-orange-100')
          setDisplayMessage('Poor Connection (Unable to measure speed)')
          break
          
        default:
          setStatusIcon('?')
          setStatusColor('bg-gray-100')
          setDisplayMessage('Unknown Status')
      }
    }

    updateDisplay()
  }, [internetStatus, lastPingMs])

  if (isCompact) {
    // Compact version for header/bar display
    return (
      <div className={`px-3 py-1 rounded text-sm font-semibold flex items-center gap-2 ${statusColor}`}>
        <span>{statusIcon}</span>
        <span>{displayMessage}</span>
      </div>
    )
  }

  // Full version for system check page
  return (
    <div className={`p-4 rounded-lg border-2 ${statusColor}`}>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{statusIcon}</div>
        <div>
          <h3 className="font-bold text-lg">{displayMessage}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {internetStatus === 'offline' && 'Please connect to the internet to start the interview.'}
            {internetStatus === 'checking' && 'We are checking your connection quality...'}
            {(internetStatus === 'good' || internetStatus === 'average') && 'Your connection is suitable for the interview.'}
            {(internetStatus === 'slow' || internetStatus === 'poor') && 'Your connection is slow, but you can still continue. You may experience delays.'}
          </p>
        </div>
      </div>
    </div>
  )
}
