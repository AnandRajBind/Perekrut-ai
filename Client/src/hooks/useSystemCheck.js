import { useCallback, useEffect, useState, useRef } from 'react'
import { useMedia } from '../context/MediaContext'
import { useScreenShare } from './useScreenShare'

// Latency-based quality thresholds (in milliseconds)
const LATENCY_THRESHOLDS = {
  good: 300,      // < 300ms = Good connection
  average: 1000,  // 300-1000ms = Average/Slow connection
  // > 1000ms = Very slow (but still connected)
}

// Multiple fallback endpoints for reliability
const CONNECTIVITY_TEST_URLS = [
  'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
  'https://www.cloudflare.com/',
  'https://www.github.com/',
  'https://www.amazon.com/',
]

export const useSystemCheck = () => {
  const {
    cameraStream,
    setCameraStream,
    microphoneTrack,
    setMicrophoneTrack,
  } = useMedia()

  const {
    screenStream,
    screenReady,
    errorMessage: screenError,
    checkScreenShare,
    stopScreenShare,
  } = useScreenShare()

  const [cameraReady, setCameraReady] = useState(false)
  const [micReady, setMicReady] = useState(false)
  const [internetStatus, setInternetStatus] = useState('checking')
  const [lastPingMs, setLastPingMs] = useState(null)
  const [permissionLost, setPermissionLost] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  
  // Track last successful test to avoid status downgrades
  const lastSuccessfulStatus = useRef(null)
  const lastTestTime = useRef(null)
  const MIN_TEST_INTERVAL = 30000 // Don't test more than every 30 seconds

  // Use screen error if available
  useEffect(() => {
    if (screenError) {
      setErrorMessage(screenError)
    }
  }, [screenError])

  /**
   * Check internet connectivity using navigator.onLine + lightweight fetch
   * Uses multiple fallback URLs for reliability
   * Implements debouncing to avoid too-frequent tests
   * Does NOT downgrade from good status on transient failures
   */
  const testInternet = useCallback(async () => {
    // Debounce: Don't test more than once every 30 seconds
    const now = Date.now()
    if (lastTestTime.current && now - lastTestTime.current < MIN_TEST_INTERVAL) {
      // Return last known status without re-testing
      if (lastSuccessfulStatus.current) {
        setInternetStatus(lastSuccessfulStatus.current)
      }
      return
    }
    lastTestTime.current = now

    setInternetStatus('checking')
    setLastPingMs(null)

    // First check: Use navigator.onLine for basic connectivity
    if (!navigator.onLine) {
      setInternetStatus('offline')
      lastSuccessfulStatus.current = null
      return
    }

    // Second check: Try multiple endpoints for reliability
    let lastError = null
    
    for (const url of CONNECTIVITY_TEST_URLS) {
      try {
        const start = performance.now()
        
        // Try to fetch with a short timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        
        const response = await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const elapsed = Math.round(performance.now() - start)
        setLastPingMs(elapsed)

        // Successfully got a response - classify connection quality
        let status = 'good'
        if (elapsed < LATENCY_THRESHOLDS.good) {
          status = 'good'
        } else if (elapsed < LATENCY_THRESHOLDS.average) {
          status = 'average'
        } else {
          status = 'slow'
        }
        
        setInternetStatus(status)
        lastSuccessfulStatus.current = status
        return // Success - exit
      } catch (err) {
        lastError = err
        // Try next URL
        continue
      }
    }

    // All URLs failed - check navigator.onLine again
    if (navigator.onLine) {
      // Device is online but all tests failed
      // Keep last successful status if available, otherwise mark as poor
      if (lastSuccessfulStatus.current) {
        setInternetStatus(lastSuccessfulStatus.current)
      } else {
        setInternetStatus('poor')
        lastSuccessfulStatus.current = 'poor'
      }
    } else {
      setInternetStatus('offline')
      lastSuccessfulStatus.current = null
    }
  }, [])

  // Monitor online/offline status changes
  useEffect(() => {
    const handleOnline = () => {
      // Reset test timer so it tests immediately
      lastTestTime.current = null
      testInternet()
    }

    const handleOffline = () => {
      setInternetStatus('offline')
      lastSuccessfulStatus.current = null
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [testInternet])

  // Test internet on component mount only (not on every testInternet change)
  useEffect(() => {
    testInternet()
  }, [testInternet])

  const checkCameraAndMic = useCallback(async () => {
    setErrorMessage('')
    setPermissionLost(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      const audioTrack = stream.getAudioTracks()[0] || null
      setCameraStream(stream)
      setMicrophoneTrack(audioTrack)
      setCameraReady(true)
      setMicReady(Boolean(audioTrack))
      return true
    } catch (err) {
      setCameraReady(false)
      setMicReady(false)
      setErrorMessage('Camera or microphone permission denied. Please allow access.')
      return false
    }
  }, [setCameraStream, setMicrophoneTrack])

  // Continuous monitoring - every 5 seconds check if devices are still active
  useEffect(() => {
    const monitoringInterval = setInterval(() => {
      let anyLost = false

      // Check camera
      if (cameraStream) {
        const videoTrack = cameraStream.getVideoTracks()[0]
        if (!videoTrack || !videoTrack.enabled || videoTrack.readyState === 'ended') {
          setCameraReady(false)
          anyLost = true
        }
      }

      // Check microphone
      if (microphoneTrack) {
        if (!microphoneTrack.enabled || microphoneTrack.readyState === 'ended') {
          setMicReady(false)
          anyLost = true
        }
      }

      if (anyLost) {
        setPermissionLost(true)
        setErrorMessage('One or more permissions were lost. Please re-enable them.')
      }
    }, 5000)

    return () => clearInterval(monitoringInterval)
  }, [cameraStream, microphoneTrack])

  /**
   * Connection is OK if:
   * - User is online (any speed: good, average, slow, or poor)
   * - NOT offline
   */
  const isOnline = internetStatus !== 'offline' && internetStatus !== 'checking'
  
  /**
   * Can start interview if:
   * - Camera and microphone are ready
   * - Screen sharing is ready (if applicable)
   * - User is online (even if slow - don't block based on latency)
   * - No permission was lost
   */
  const canStart = cameraReady && micReady && screenReady && isOnline && !permissionLost

  /**
   * Get user-friendly connection message
   */
  const getConnectionMessage = () => {
    switch (internetStatus) {
      case 'offline':
        return '✗ No Internet Connection'
      case 'checking':
        return '⏳ Checking Connection...'
      case 'good':
        return `✓ Good Connection (${lastPingMs}ms)`
      case 'average':
        return `⚠ Average Connection (${lastPingMs}ms)`
      case 'slow':
        return `⚠ Slow Connection (${lastPingMs}ms)`
      case 'poor':
        return '⚠ Poor Connection (Unable to check speed)'
      default:
        return 'Unknown'
    }
  }

  return {
    cameraStream,
    screenStream,
    microphoneTrack,
    cameraReady,
    micReady,
    screenReady,
    internetStatus,
    lastPingMs,
    errorMessage,
    permissionLost,
    canStart,
    isOnline,
    getConnectionMessage,
    setErrorMessage,
    testInternet,
    checkCameraAndMic,
    checkScreenShare,
    stopScreenShare,
  }
}
