import { useCallback, useEffect, useState } from 'react'
import { useMedia } from '../context/MediaContext'
import { useScreenShare } from './useScreenShare'

// Latency-based quality thresholds (in milliseconds)
const LATENCY_THRESHOLDS = {
  good: 300,      // < 300ms = Good connection
  average: 1000,  // 300-1000ms = Average/Slow connection
  // > 1000ms = Very slow (but still connected)
}

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

  // Use screen error if available
  useEffect(() => {
    if (screenError) {
      setErrorMessage(screenError)
    }
  }, [screenError])

  /**
   * Check internet connectivity using navigator.onLine + lightweight fetch
   * Does NOT depend on backend API for status
   * Returns: 'connected' (any speed), 'slow' (>1s latency), or 'offline'
   */
  const testInternet = useCallback(async () => {
    setInternetStatus('checking')
    setLastPingMs(null)

    // First check: Use navigator.onLine for basic connectivity
    if (!navigator.onLine) {
      setInternetStatus('offline')
      return
    }

    // Second check: Perform latency test using lightweight resource
    try {
      const start = performance.now()
      
      // Use Google's 1x1 transparent pixel with no-cors mode
      // This is a lightweight, widely-available resource
      const response = await Promise.race([
        fetch('https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
        }),
        // Timeout after 10 seconds
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        ),
      ])

      const elapsed = Math.round(performance.now() - start)
      setLastPingMs(elapsed)

      // Classify connection quality based on latency
      if (elapsed < LATENCY_THRESHOLDS.good) {
        setInternetStatus('good')
      } else if (elapsed < LATENCY_THRESHOLDS.average) {
        setInternetStatus('average')
      } else {
        // Still connected, just slow
        setInternetStatus('slow')
      }
    } catch (err) {
      console.warn('Internet latency check failed:', err.message)
      
      // If navigator.onLine is true but fetch failed, could be:
      // - DNS issue
      // - Captive portal
      // - Poor connectivity
      // But we're still connected enough to potentially interview
      
      if (navigator.onLine) {
        // Device is online but check failed - assume poor but connected
        setInternetStatus('poor')
      } else {
        setInternetStatus('offline')
      }
    }
  }, [])

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
