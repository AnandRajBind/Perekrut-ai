import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckCircle, AlertCircle, Loader, Video, Mic, Share2 } from 'lucide-react'
import { useSystemCheck } from '../hooks/useSystemCheck'

const PublicSystemCheck = ({ onProceed = null, isPublicMock = false }) => {
  const { token } = useParams()
  const navigate = useNavigate()
  const {
    cameraStream,
    screenStream,
    microphoneTrack,
    cameraReady,
    micReady,
    screenReady,
    internetStatus,
    lastPingMs,
    canStart,
    permissionLost,
    errorMessage,
    testInternet,
    checkCameraAndMic,
    checkScreenShare,
    stopScreenShare,
  } = useSystemCheck()

  const [isStarting, setIsStarting] = useState(false)
  const [isCheckingCamera, setIsCheckingCamera] = useState(false)
  const [isCheckingScreen, setIsCheckingScreen] = useState(false)
  const [interviewData, setInterviewData] = useState(null)
  const [showPermissionWarning, setShowPermissionWarning] = useState(false)

  const videoRef = useRef(null)
  const screenVideoRef = useRef(null)

  // Load interview data
  useEffect(() => {
    // For mock interviews, data is stored as 'interviewData'
    // For token-based interviews, data is stored as 'currentInterview'
    const savedInterview = localStorage.getItem('currentInterview') || localStorage.getItem('interviewData')
    
    if (!savedInterview) {
      const errorMsg = isPublicMock ? 'Please start from the home page.' : 'Interview session not found'
      toast.error(errorMsg, {
        position: 'top-right',
        autoClose: 3000,
      })
      
      if (isPublicMock) {
        navigate('/')
      } else {
        navigate(`/interview/session/${token}`)
      }
      return
    }
    
    const interviewDataParsed = JSON.parse(savedInterview)
    setInterviewData(interviewDataParsed)
    
    // Store as 'currentInterview' for consistency
    localStorage.setItem('currentInterview', JSON.stringify(interviewDataParsed))
  }, [token, navigate, isPublicMock])

  // Setup video preview
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    }
  }, [cameraStream])

  // Setup screen preview
  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream
      screenVideoRef.current.play().catch(() => {})
    }
  }, [screenStream])

  // Test internet on load
  useEffect(() => {
    testInternet()
    // Only run once on mount, not on every testInternet change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show warning when permission is lost
  useEffect(() => {
    if (permissionLost) {
      setShowPermissionWarning(true)
      toast.warning('⚠️ Permission lost! Please re-enable camera/microphone.', {
        position: 'top-right',
        autoClose: 5000,
      })
    }
  }, [permissionLost])

  const handleCameraCheck = async () => {
    setIsCheckingCamera(true)
    try {
      const success = await checkCameraAndMic()
      if (success) {
        toast.success('✅ Camera and microphone enabled!', {
          position: 'top-right',
          autoClose: 2000,
        })
      }
    } finally {
      setIsCheckingCamera(false)
    }
  }

  const handleScreenCheck = async () => {
    setIsCheckingScreen(true)
    try {
      const success = await checkScreenShare()
      if (success) {
        toast.success('✅ Screen sharing enabled!', {
          position: 'top-right',
          autoClose: 2000,
        })
      } else if (errorMessage) {
        toast.error(`❌ ${errorMessage}`, {
          position: 'top-right',
          autoClose: 3000,
        })
      }
    } finally {
      setIsCheckingScreen(false)
    }
  }

  const handleStartInterview = async () => {
    if (!canStart) {
      toast.error('Please complete all system checks before starting', {
        position: 'top-right',
        autoClose: 3000,
      })
      return
    }

    setIsStarting(true)
    try {
      if (isPublicMock && onProceed) {
        // For public mock interviews, call the onProceed callback
        onProceed()
      } else {
        // For regular interviews with token
        navigate(`/interview/session/${token}/video`)
      }
    } catch (error) {
      toast.error('Failed to start interview', {
        position: 'top-right',
        autoClose: 3000,
      })
      setIsStarting(false)
    }
  }

  if (!interviewData) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin text-blue-600" size={40} />
          <p className="text-gray-600">Loading interview session...</p>
        </div>
      </div>
    )
  }

  const internetLabel = {
    checking: 'Checking...',
    excellent: 'Excellent',
    good: 'Good',
    poor: 'Poor',
  }[internetStatus] || 'Unknown'

  const statusBadge = (ready) => (
    <div className="flex items-center gap-2">
      {ready ? (
        <>
          <CheckCircle className="text-green-600" size={20} />
          <span className="text-sm font-medium text-green-700">Ready</span>
        </>
      ) : (
        <>
          <AlertCircle className="text-red-600" size={20} />
          <span className="text-sm font-medium text-red-700">Not ready</span>
        </>
      )}
    </div>
  )

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 overflow-hidden flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">System Check</h1>
          <p className="text-gray-600 text-sm">
            Let's make sure your setup is ready for the {interviewData.jobRole} interview
          </p>
        </div>

        {/* Permission Lost Warning */}
        {showPermissionWarning && permissionLost && (
          <div className="mb-3 bg-red-50 border-2 border-red-300 rounded p-2 flex gap-2">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="font-semibold text-red-900 mb-0.5 text-sm">Permission Lost</h3>
              <p className="text-red-800 text-xs">
                Your camera, microphone, or screen share permission was lost. Please re-enable them.
              </p>
            </div>
          </div>
        )}

        {/* Error Message Display */}
        {errorMessage && (
          <div className="mb-3 bg-yellow-50 border-2 border-yellow-300 rounded p-2 flex gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-0.5 text-sm">Attention Required</h3>
              <p className="text-yellow-800 text-xs">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
          {/* Left: Camera Preview - Smaller */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="relative bg-black w-full aspect-square flex items-center justify-center flex-shrink-0">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <p className="text-white text-center text-sm">Camera not detected</p>
                </div>
              )}
            </div>
            <div className="p-2 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <Video size={16} className={cameraReady ? 'text-green-600' : 'text-gray-400'} />
                  <p className="text-gray-700 font-medium text-xs">Camera</p>
                </div>
                {statusBadge(cameraReady && micReady)}
              </div>
              <button
                onClick={handleCameraCheck}
                disabled={isCheckingCamera}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {isCheckingCamera && <Loader size={10} className="animate-spin" />}
                Test
              </button>
            </div>
          </div>

          {/* Center: Screen Share Preview - Larger */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="relative bg-gray-100 w-full flex-1 flex items-center justify-center overflow-hidden">
              {screenReady ? (
                <video
                  ref={screenVideoRef}
                  className="w-full h-full object-contain"
                  muted
                  playsInline
                />
              ) : (
                <div className="text-center p-4">
                  <Share2 size={40} className="text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2 text-sm">Screen sharing not enabled</p>
                  <p className="text-gray-500 text-xs mb-4">
                    Share your entire screen for the interview
                  </p>
                </div>
              )}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Share2 size={18} className={screenReady ? 'text-green-600' : 'text-gray-400'} />
                  <p className="text-gray-700 font-medium text-sm">Entire Screen Share</p>
                </div>
                {statusBadge(screenReady)}
              </div>
              <button
                onClick={handleScreenCheck}
                disabled={isCheckingScreen}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {isCheckingScreen && <Loader size={12} className="animate-spin" />}
                {screenReady ? 'Disable' : 'Enable Screen Share'}
              </button>
            </div>
          </div>

          {/* Right: Status Panel */}
          <div className="lg:col-span-1 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">System Status</h2>

              {/* Internet */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-700 font-medium text-sm">Internet Connection</p>
                  {statusBadge(internetStatus !== 'poor')}
                </div>
                <p className="text-xs text-gray-600">
                  {internetLabel}
                  {lastPingMs && ` • ${lastPingMs}ms`}
                </p>
              </div>

              {/* Camera Status */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-700 font-medium text-sm">Camera</p>
                  {statusBadge(cameraReady)}
                </div>
                <button
                  onClick={handleCameraCheck}
                  disabled={isCheckingCamera}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {isCheckingCamera ? 'Testing...' : 'Test Camera'}
                </button>
              </div>

              {/* Microphone Status */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-700 font-medium text-sm">Microphone</p>
                  {statusBadge(micReady)}
                </div>
                <button
                  onClick={handleCameraCheck}
                  disabled={isCheckingCamera}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {isCheckingCamera ? 'Testing...' : 'Test Microphone'}
                </button>
              </div>

              {/* Screen Share Status */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-700 font-medium text-sm">Screen Share</p>
                  {statusBadge(screenReady)}
                </div>
                <button
                  onClick={handleScreenCheck}
                  disabled={isCheckingScreen}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  {isCheckingScreen ? 'Configuring...' : 'Enable Screen Share'}
                </button>
              </div>

              {/* Interview Details */}
              <div className="bg-blue-50 rounded p-3 mb-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-xs">Interview Details</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Position:</span>
                    <span className="font-medium text-gray-900">{interviewData.jobRole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium text-gray-900">{interviewData.interviewType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Level:</span>
                    <span className="font-medium text-gray-900">{interviewData.experienceLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Questions:</span>
                    <span className="font-medium text-gray-900">{interviewData.numberOfQuestions}</span>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartInterview}
                disabled={!canStart || isStarting || permissionLost}
                title={!canStart ? 'Complete all checks first' : ''}
                className={`w-full py-2 rounded font-semibold transition text-sm ${
                  canStart && !isStarting && !permissionLost
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
              >
                {isStarting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size={14} className="animate-spin" />
                    Starting...
                  </span>
                ) : (
                  '🎥 Start Interview'
                )}
              </button>

              {!canStart && (
                <p className="text-xs text-gray-600 text-center mt-2">
                  ⚠️ Complete all checks to start interview
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublicSystemCheck
