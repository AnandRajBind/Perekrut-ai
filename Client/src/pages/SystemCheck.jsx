import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useInterview } from '../hooks/useInterview'
import { useSystemCheck } from '../hooks/useSystemCheck'

const SystemCheck = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { startInterview, currentInterview } = useInterview()
  const {
    cameraStream,
    screenStream,
    microphoneTrack,
    cameraReady,
    micReady,
    screenReady,
    internetStatus,
    lastPingMs,
    errorMessage,
    canStart,
    setErrorMessage,
    testInternet,
    checkCameraAndMic,
    checkScreenShare,
  } = useSystemCheck()

  const [isStarting, setIsStarting] = useState(false)
  const [screenPromptVisible, setScreenPromptVisible] = useState(false)
  const videoRef = useRef(null)
  const screenVideoRef = useRef(null)

  const interviewConfig = location.state

  const internetLabel = useMemo(() => {
    if (internetStatus === 'checking') return 'Checking...'
    if (internetStatus === 'excellent') return 'Excellent'
    if (internetStatus === 'good') return 'Good'
    return 'Poor'
  }, [internetStatus])

  useEffect(() => {
    if (!interviewConfig && !currentInterview) {
      navigate('/interview-mode')
    }
  }, [interviewConfig, currentInterview, navigate])

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    }
  }, [cameraStream])

  useEffect(() => {
    if (screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream
      screenVideoRef.current.play().catch(() => {})
    }
  }, [screenStream])

  useEffect(() => {
    testInternet()
    // Only run once on mount, not on every testInternet change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusBadge = (ready) => (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
        ready ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {ready ? 'Ready' : 'Not ready'}
    </span>
  )

  const handleScreenCheckWithPrompt = () => {
    setScreenPromptVisible(true)
  }

  const handleStartInterview = async () => {
    if (!canStart) return
    if (currentInterview) {
      // Save interview to localStorage for video interview room
      localStorage.setItem('currentInterview', JSON.stringify(currentInterview))
      navigate('/interview-screen')
      return
    }
    if (!interviewConfig) return

    setIsStarting(true)
    setErrorMessage('')

    try {
      const {
        jobRole,
        experienceLevel,
        interviewType,
        difficultyLevel,
        numberOfQuestions,
      } = interviewConfig

      const interview = await startInterview(
        jobRole,
        experienceLevel,
        interviewType,
        difficultyLevel,
        numberOfQuestions
      )
      
      // Save interview to localStorage for video interview room
      if (interview) {
        console.log('💾 Saving interview to localStorage:', interview)
        localStorage.setItem('currentInterview', JSON.stringify(interview))
      }

      navigate('/interview-screen')
    } catch (err) {
      setErrorMessage('Failed to start interview. Please try again.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 px-4 py-8 sm:px-6 lg:px-8">
      {screenPromptVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900">Share Entire Screen Only</h3>
            <p className="mt-2 text-sm text-gray-600">
              Please select the <strong>Entire screen</strong> tab in the browser dialog. Window or
              tab sharing is not allowed.
            </p>
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700">
              Tip: Choose the monitor with your full desktop so we can keep the interview secure.
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setScreenPromptVisible(false)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setScreenPromptVisible(false)
                  await checkScreenShare()
                }}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 sm:w-auto"
              >
                Continue to Share
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">System Check</h1>
          <p className="text-gray-600 mt-2">Complete these checks before starting your interview.</p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        {screenStream && (
          <video ref={screenVideoRef} autoPlay muted playsInline className="hidden" />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Camera and Microphone</h2>
              {statusBadge(cameraReady && micReady)}
            </div>
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
              {cameraStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <p className="text-gray-500 text-sm">Camera preview will appear here</p>
              )}
            </div>
            <button
              type="button"
              onClick={checkCameraAndMic}
              className="mt-4 w-full rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 transition"
            >
              Check Camera and Mic
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Screen Share</h2>
              {statusBadge(screenReady)}
            </div>
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-600">
              Share your entire screen to continue. Window or tab share is not allowed.
            </div>
            <button
              type="button"
              onClick={handleScreenCheckWithPrompt}
              className="mt-4 w-full rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 transition"
            >
              Share Full Screen
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Internet Connection</h2>
              {statusBadge(internetStatus === 'excellent' || internetStatus === 'good')}
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Status: {internetLabel}</span>
              {lastPingMs !== null && <span>Ping: {lastPingMs} ms</span>}
            </div>
            <button
              type="button"
              onClick={testInternet}
              className="mt-4 w-full rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 transition"
            >
              Re-test Connection
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Checklist</h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>Camera access: {cameraReady ? 'Ready' : 'Not ready'}</li>
                <li>Microphone access: {micReady ? 'Ready' : 'Not ready'}</li>
                <li>Screen share: {screenReady ? 'Ready' : 'Not ready'}</li>
                <li>Internet: {internetLabel}</li>
              </ul>
              {microphoneTrack && (
                <p className="text-xs text-gray-500 mt-3">
                  Microphone active: {microphoneTrack.enabled ? 'Yes' : 'No'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleStartInterview}
              disabled={!canStart || isStarting}
              className={`mt-6 w-full rounded-lg py-3 font-semibold transition ${
                canStart
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isStarting ? 'Starting...' : 'Start Interview'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemCheck
