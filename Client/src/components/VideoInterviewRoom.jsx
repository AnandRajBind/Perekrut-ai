import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Loader } from 'lucide-react'
import AIAvatar from './AIAvatar'
import QuestionCaption from './QuestionCaption'
import ListeningIndicator from './ListeningIndicator'
import TranscriptPanel from './TranscriptPanel'
import CandidateVideo from './CandidateVideo'
import DraggableVideo from './DraggableVideo'
import InterviewControls from './InterviewControls'
import InterviewProgress from './InterviewProgress'
import InterviewAnswerControls from './InterviewAnswerControls'
import { useInterviewSession } from '../hooks/useInterviewSession'
import { useMedia } from '../context/MediaContext'
import { useSystemCheck } from '../hooks/useSystemCheck'

const VideoInterviewRoom = () => {
  const { token } = useParams()
  const navigate = useNavigate()
  const { cameraStream } = useMedia()
  const { internetStatus, lastPingMs } = useSystemCheck()

  const [isLoading, setIsLoading] = useState(true)
  const [interviewData, setInterviewData] = useState(null)
  const [isMicEnabled, setIsMicEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  
  // Map internal internet status to UI status
  const connectionStatus = (() => {
    switch (internetStatus) {
      case 'good':
        return 'good'
      case 'average':
      case 'slow':
        return 'fair'
      case 'poor':
      case 'offline':
        return 'poor'
      default:
        return 'checking'
    }
  })()
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])

  // Interview session hook
  const interview = useInterviewSession(interviewData)

  // Load interview data and setup
  useEffect(() => {
    const savedInterview = localStorage.getItem('currentInterview')
    if (!savedInterview) {
      toast.error('Interview session not found', {
        position: 'top-right',
        autoClose: 3000,
      })
      navigate(`/interview/session/${token}`)
      return
    }

    const data = JSON.parse(savedInterview)
    console.log('📋 Loaded interview data from localStorage:', data)
    console.log('Interview ID available:', data?._id || data?.id || data?.interviewId)
    
    setInterviewData(data)
    setIsLoading(false)

    // Start recording when interview starts
    startRecording()
  }, [token, navigate])

  // Handle interview completion
  useEffect(() => {
    if (interview.interviewStatus === 'completed' && interview.completionResults) {
      console.log('✅ Interview completed! Showing success dialog...')
      
      // Stop recording
      stopRecording().then(() => {
        // Show success dialog
        setShowSuccessDialog(true)
        setCountdown(5)
      })
    } else if (interview.interviewStatus === 'error') {
      console.error('❌ Interview completion failed:', interview.answerSubmitError)
      toast.error(`Failed to submit interview: ${interview.answerSubmitError}`, {
        position: 'top-right',
        autoClose: 5000,
      })
    }
  }, [interview.interviewStatus, interview.completionResults, interview.answerSubmitError])

  // Handle success dialog countdown
  useEffect(() => {
    if (!showSuccessDialog) return
    
    if (countdown <= 0) {
      // Save completion data to sessionStorage
      sessionStorage.setItem('interviewCompletion', JSON.stringify({
        completedAt: new Date().toISOString(),
        interviewId: interview.completionResults?.interviewId,
      }))
      
      // Redirect to success page
      setTimeout(() => {
        navigate('/interview/success')
      }, 500)
      return
    }
    
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [showSuccessDialog, countdown, navigate, interview.completionResults])

  // Handle microphone toggle - mute/unmute audio tracks
  useEffect(() => {
    if (cameraStream) {
      cameraStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicEnabled
      })
    }
    
    // If mic is disabled and currently listening, stop listening
    if (!isMicEnabled && interview.isListening) {
      console.log('⏹️ Stopping listening because microphone was disabled')
      interview.stopAnswer()
    }
  }, [isMicEnabled, cameraStream, interview])

  // Handle video toggle - disable/enable video tracks
  useEffect(() => {
    if (cameraStream) {
      cameraStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoEnabled
      })
    }
  }, [isVideoEnabled, cameraStream])

  // Start recording media
  const startRecording = () => {
    try {
      if (!cameraStream) {
        throw new Error('Camera stream not available')
      }

      const chunks = []
      recordedChunksRef.current = chunks

      // Get audio from microphone if available
      const audioTracks = []
      if (cameraStream.getAudioTracks().length > 0) {
        audioTracks.push(...cameraStream.getAudioTracks())
      }

      const recordingStream = new MediaStream([
        ...cameraStream.getVideoTracks(),
        ...audioTracks,
      ])

      const mediaRecorder = new MediaRecorder(recordingStream)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (error) {
      console.error('Recording error:', error)
      toast.error('Failed to start recording: ' + error.message, {
        position: 'top-right',
        autoClose: 3000,
      })
    }
  }

  // Stop recording and save
  const stopRecording = async () => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)

          // Save to localStorage (or send to backend)
          localStorage.setItem(
            'interviewRecording',
            JSON.stringify({
              url,
              duration: interview.timeElapsed,
              timestamp: new Date().toISOString(),
            })
          )

          setIsRecording(false)
          resolve(url)
        }
        mediaRecorderRef.current.stop()
      } else {
        resolve(null)
      }
    })
  }

  // Handle end interview
  const handleEndInterview = async () => {
    toast.info('Finalizing interview...', {
      position: 'top-right',
    })

    // Stop recording
    await stopRecording()

    // Save answers to localStorage
    localStorage.setItem(
      'interviewAnswers',
      JSON.stringify({
        answers: interview.answers,
        timeElapsed: interview.timeElapsed,
        interviewId: interviewData.id,
      })
    )

    // Redirect to results
    setTimeout(() => {
      navigate(`/interview/session/${token}/results`)
    }, 1000)
  }

  // Monitor internet connection quality in real-time
  // Connection status automatically updates via useSystemCheck hook
  useEffect(() => {
    if (connectionStatus === 'poor') {
      toast.warning('Your internet connection is slow. The interview may experience delays.', {
        position: 'top-right',
        autoClose: 5000,
      })
    }
  }, [connectionStatus])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin text-blue-300" size={48} />
          <p className="text-white text-lg">Initializing Interview...</p>
        </div>
      </div>
    )
  }

  const currentQuestion = interview.getCurrentQuestion()

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 to-black flex flex-col overflow-hidden">
      {/* Progress Bar */}
      <InterviewProgress
        currentQuestion={interview.getCurrentQuestionNumber()}
        totalQuestions={interview.getTotalQuestions()}
        timeElapsed={interview.timeElapsed}
      />

      {/* Main Interview Area */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: AI Avatar */}
          <div className="lg:col-span-1 flex flex-col justify-center items-center">
            <AIAvatar isSpeaking={interview.isSpeaking} />
          </div>

          {/* Center: Question & Answer Controls */}
          <div className="lg:col-span-1 flex flex-col justify-between gap-4">
            {currentQuestion && !interview.isInterviewComplete() && (
              <>
                <QuestionCaption
                  question={currentQuestion}
                  isAnimating={interview.isSpeaking}
                  speed={30}
                />

                {/* Manual Answer Controls */}
                <InterviewAnswerControls
                  isListening={interview.isListening}
                  isSpeaking={interview.isSpeaking}
                  readyForAnswer={interview.readyForAnswer}
                  onPlayAgain={interview.replayQuestion}
                  onStartAnswer={interview.startAnswer}
                  onStopAnswer={interview.stopAnswer}
                  disabled={interview.isInterviewComplete()}
                  isMicEnabled={isMicEnabled}
                  onMicDisabledAttempt={() => {
                    toast.warning('Microphone is disabled. Enable it to record answers.', {
                      position: 'top-right',
                      autoClose: 2000,
                    })
                  }}
                />

                <ListeningIndicator
                  isListening={interview.isListening}
                  transcript={interview.spokenText}
                  audioStream={interview.audioStream}
                />
              </>
            )}

            {interview.isInterviewComplete() && (
              <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-800 rounded-lg border-2 border-green-500">
                <div className="text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-white font-bold text-lg">Interview Complete!</p>
                  <p className="text-gray-300 text-sm mt-2">
                    Thank you for your responses. Your interview is being evaluated...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Transcript & Candidate Video */}
          <div className="lg:col-span-1 flex flex-col gap-3 relative">
            <div className="flex-1 overflow-hidden">
              <TranscriptPanel transcript={interview.transcript} />
            </div>

            {/* Floating Candidate Video - Draggable and Resizable */}
            <DraggableVideo stream={cameraStream} isRecording={isRecording} />
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <InterviewControls
        isMicEnabled={isMicEnabled}
        isVideoEnabled={isVideoEnabled}
        isTakingResponse={interview.isTakingResponse}
        onMicToggle={() => setIsMicEnabled(!isMicEnabled)}
        onVideoToggle={() => setIsVideoEnabled(!isVideoEnabled)}
        onEndInterview={handleEndInterview}
        onSkipQuestion={interview.skipQuestion}
        connectionStatus={connectionStatus}
      />

      {/* Success Dialog */}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md border-2 border-green-500 shadow-2xl animate-bounceIn">
            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-4xl">✅</span>
              </div>
            </div>

            {/* Message */}
            <h2 className="text-2xl font-bold text-center text-white mb-2">
              Interview Submitted Successfully!
            </h2>
            <p className="text-center text-gray-300 mb-6">
              Thank you for completing the interview. Your responses have been recorded and will be evaluated shortly.
            </p>

            {/* Countdown */}
            <div className="flex flex-col items-center mb-6">
              <div className="text-4xl font-bold text-green-400 font-mono">
                {countdown}s
              </div>
              <div className="mt-4 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000"
                  style={{ width: `${(countdown / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">You will be redirected automatically</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoInterviewRoom


