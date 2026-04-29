import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ChevronRight, ChevronLeft, Volume2, Phone, SkipForward, Loader, AlertCircle } from 'lucide-react'
import { speakText } from '../utils/speechUtils'
import VoiceRecorder from '../components/VoiceRecorder'
import AIAvatar from '../components/AIAvatar'
import TranscriptPanel from '../components/TranscriptPanel'
import { useMedia } from '../context/MediaContext'
import { retryWithBackoff, retryInterviewSubmission } from '../services/retryService'

const PublicInterviewScreen = ({ isPublicMock = false, onComplete = null }) => {
  const { token } = useParams()
  const navigate = useNavigate()
  const { cameraStream, microphoneTrack } = useMedia()

  const [interviewData, setInterviewData] = useState(null)
  const [sessionLockId, setSessionLockId] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [recordedAnswer, setRecordedAnswer] = useState(null)
  const [answerType, setAnswerType] = useState('text') // 'text', 'voice'
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const [isResuming, setIsResuming] = useState(false)
  const [retryingSubmission, setRetryingSubmission] = useState(false)
  const [isMockInterview, setIsMockInterview] = useState(false) // Flag to detect mock interviews
  const [isMockAISpeaking, setIsMockAISpeaking] = useState(false) // AI speaking indicator for mock
  const [mockTranscript, setMockTranscript] = useState([]) // Transcript for mock interview
  const [transcriptInitialized, setTranscriptInitialized] = useState(false) // Track if transcript is initialized
  const sessionTimeoutRef = useRef(null)

  // ===== PRODUCTION READINESS: Session Recovery on Mount =====
  useEffect(() => {
    const loadOrResumeSession = async () => {
      try {
        // Check if this is a mock interview
        const mockFlag = localStorage.getItem('isMockInterview') === 'true'
        setIsMockInterview(mockFlag)

        // Try to get saved interview data
        const savedInterview = localStorage.getItem('mockInterviewData') || localStorage.getItem('interviewData') || localStorage.getItem('currentInterview')
        const savedSessionLockId = sessionStorage.getItem('sessionLockId')
        const savedInterviewId = sessionStorage.getItem('interviewId')

        if (!savedInterview) {
          toast.error('Interview session not found', {
            position: 'top-right',
            autoClose: 3000,
          })
          if (mockFlag || isPublicMock) {
            navigate('/')
          } else {
            navigate(`/interview/session/${token}`)
          }
          return
        }

        const interviewDataParsed = JSON.parse(savedInterview)
        setInterviewData(interviewDataParsed)
        setSessionLockId(savedSessionLockId)
        
        // Debug logging
        console.log('Interview Data Loaded:', interviewDataParsed)
        console.log('Questions:', interviewDataParsed?.questions)
        
        // Also store as currentInterview for consistency
        localStorage.setItem('currentInterview', JSON.stringify(interviewDataParsed))

        // For mock interviews, skip server-side session recovery
        if (mockFlag || isPublicMock) {
          // Just load from localStorage, no server resume needed
          const savedAnswers = localStorage.getItem('interviewAnswers')
          if (savedAnswers) {
            setAnswers(JSON.parse(savedAnswers))
          }
          // Default to voice mode for mock interviews
          setAnswerType('voice')
          setIsResuming(false)
          return
        }

        // For authenticated interviews, try to resume from server
        if (savedSessionLockId && savedInterviewId) {
          setIsResuming(true)
          try {
            const resumeResponse = await fetch(
              `${import.meta.env.VITE_API_URL}/interview/session/${savedInterviewId}/resume?sessionLockId=${savedSessionLockId}`
            )

            if (resumeResponse.ok) {
              const resumeData = await resumeResponse.json()
              if (resumeData.data) {
                // Restore state from server
                setCurrentQuestionIndex(resumeData.data.currentQuestionIndex || 0)
                setAnswers(resumeData.data.answers || {})

                toast.success(
                  `Resuming from question ${resumeData.data.currentQuestionIndex + 1}`,
                  {
                    position: 'top-right',
                    autoClose: 2000,
                  }
                )
              }
              } else if (resumeResponse.status === 410) {
              // Session expired
              toast.error('Interview session has expired. Please start a new one.', {
                position: 'top-right',
                autoClose: 3000,
              })
              navigate(`/interview/session/${token}`)
              return
            }
          } catch (error) {
            console.warn('Could not resume from server, using local state:', error)
            // Fall back to localStorage if resume fails
            const savedAnswers = localStorage.getItem('interviewAnswers')
            if (savedAnswers) {
              setAnswers(JSON.parse(savedAnswers))
            }
          }
          setIsResuming(false)
        }
      } catch (error) {
        console.error('Error loading session:', error)
        toast.error('Failed to load interview session', {
          position: 'top-right',
          autoClose: 3000,
        })
      }
    }

    loadOrResumeSession()
  }, [token, navigate, isPublicMock])

  // ===== PRODUCTION READINESS: Session Timeout Protection =====
  useEffect(() => {
    if (!interviewData || !sessionLockId) return

    // Reset timeout on activity
    const resetTimeout = () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
      }

      // Set 30-minute timeout
      sessionTimeoutRef.current = setTimeout(() => {
        toast.error('Interview session has expired due to inactivity.', {
          position: 'top-right',
          autoClose: 3000,
        })
        if (isPublicMock) {
          navigate('/')
        } else {
          navigate(`/interview/session/${token}`)
        }
      }, 30 * 60 * 1000)
    }

    resetTimeout()

    // Reset on any user activity
    const handleActivity = () => resetTimeout()
    document.addEventListener('click', handleActivity)
    document.addEventListener('keypress', handleActivity)

    return () => {
      document.removeEventListener('click', handleActivity)
      document.removeEventListener('keypress', handleActivity)
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current)
      }
    }
  }, [interviewData, sessionLockId, token, navigate])

  // Timer countdown
  useEffect(() => {
    if (!interviewData) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmitAnswer()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [interviewData, currentQuestionIndex])

  // ===== MOCK INTERVIEW ENHANCEMENT: Initialize transcript once on mount =====
  useEffect(() => {
    if (!isMockInterview || !interviewData?.questions || transcriptInitialized) return

    // Initialize transcript ONCE with all questions
    const initialTranscript = interviewData.questions.map((question) => ({
      question,
      answer: '',
    }))
    setMockTranscript(initialTranscript)
    setTranscriptInitialized(true)
  }, [isMockInterview, interviewData, transcriptInitialized])

  // ===== MOCK INTERVIEW: Auto-play questions when question index changes =====
  useEffect(() => {
    if (!isMockInterview || !interviewData?.questions) return

    // Auto-play the question for mock interviews
    const currentQuestion = interviewData.questions[currentQuestionIndex]
    if (currentQuestion) {
      // Set AI as speaking
      setIsMockAISpeaking(true)
      
      // Speak the question
      speakText(currentQuestion)
      
      // Stop speaking indicator after a reasonable time
      const speakingTimeout = setTimeout(() => {
        setIsMockAISpeaking(false)
      }, 3000) // 3 seconds - adjust based on question length

      return () => clearTimeout(speakingTimeout)
    }
  }, [isMockInterview, interviewData?.questions, currentQuestionIndex])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleTextAnswer = (value) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [currentQuestionIndex]: {
          type: 'text',
          content: value,
        },
      }
      
      // Update mock transcript immediately when answer changes
      if (isMockInterview && value.trim()) {
        setMockTranscript((prevTranscript) => {
          const transcriptCopy = [...prevTranscript]
          if (transcriptCopy[currentQuestionIndex]) {
            transcriptCopy[currentQuestionIndex].answer = value
          }
          return transcriptCopy
        })
      }
      
      return updated
    })
  }

  const handleVoiceAnswer = (transcript) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [currentQuestionIndex]: {
          type: 'voice',
          content: transcript,
        },
      }
      
      // Update mock transcript with voice answer
      if (isMockInterview && transcript.trim()) {
        setMockTranscript((prevTranscript) => {
          const transcriptCopy = [...prevTranscript]
          if (transcriptCopy[currentQuestionIndex]) {
            transcriptCopy[currentQuestionIndex].answer = transcript
          }
          return transcriptCopy
        })
      }
      
      return updated
    })
    setRecordedAnswer(transcript)
  }

  // Handle voice recording completion - automatically move to next question
  const handleVoiceRecordingComplete = async (transcript) => {
    if (!transcript || !interviewData || submitting) return // No transcript or interview data, do nothing
    
    try {
      // IMPORTANT: Calculate current state values BEFORE async operations
      const totalQuestions = interviewData.questions.length
      const currentIndex = currentQuestionIndex
      const isLastQuestion = currentIndex >= totalQuestions - 1 // Guard against invalid indices
      
      console.log(`Voice Recording Complete: Q${currentIndex + 1}/${totalQuestions}, isLastQuestion=${isLastQuestion}`)
      
      // Step 1: Update local state with answer
      setAnswers((prev) => {
        const updated = {
          ...prev,
          [currentIndex]: {
            type: 'voice',
            content: transcript,
          },
        }
        console.log(`Answers updated for Q${currentIndex}: ${transcript.substring(0, 50)}...`)
        return updated
      })
      
      // Step 2: Update transcript display
      setMockTranscript((prev) => {
        const updated = [...prev]
        if (updated[currentIndex]) {
          updated[currentIndex].answer = transcript
          console.log(`Transcript updated for Q${currentIndex}`)
        }
        return updated
      })
      
      setRecordedAnswer(transcript)

      // Step 3: Save the answer to backend
      if (isMockInterview && interviewData) {
        console.log(`Saving answer to backend for Q${currentIndex}...`)
        const saveResponse = await fetch(`${import.meta.env.VITE_API_URL}/mock/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interviewId: interviewData.interviewId,
            questionIndex: currentIndex,
            answer: transcript,
            format: 'voice',
          }),
        })

        if (!saveResponse.ok) {
          console.error(`Failed to save answer: ${saveResponse.status}`)
          toast.error('Failed to save your answer. Please try again.')
          return
        }
        console.log(`Successfully saved answer for Q${currentIndex}`)
      }

      // Step 4: Auto-advance after successful save and delay
      console.log(`Starting auto-advance with 1200ms delay...`)
      setTimeout(() => {
        try {
          console.log(`Auto-advance timeout triggered: isLastQuestion=${isLastQuestion}`)
          
          if (isLastQuestion) {
            // Last question - complete entire interview
            console.log('Last question reached - submitting interview')
            setSubmitting(true)
            // Call handleSubmitAnswer in next tick to avoid stale closure
            Promise.resolve().then(() => handleSubmitAnswer())
          } else {
            // Move to next question
            const nextIndex = currentIndex + 1
            console.log(`Advancing: Q${currentIndex + 1} -> Q${nextIndex + 1}/${totalQuestions}`)
            setCurrentQuestionIndex(nextIndex)
            setTimeLeft(300)
            setRecordedAnswer(null)
          }
        } catch (error) {
          console.error('Error auto-advancing:', error)
          toast.error('Error moving to next question. Please click Next manually.')
        }
      }, 1200) // Increased delay to 1200ms for reliable state updates
    } catch (error) {
      console.error('Error in voice recording completion:', error)
      toast.error('Error processing your answer. Please try again.')
    }
  }

  // ===== PRODUCTION READINESS: Save Progress After Each Answer =====
  const saveProgress = async () => {
    // For mock interviews, save to backend API
    if (isMockInterview && interviewData) {
      try {
        const currentAnswer = answers[currentQuestionIndex]
        if (!currentAnswer || !currentAnswer.content) {
          return // Nothing to save
        }

        await fetch(`${import.meta.env.VITE_API_URL}/mock/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interviewId: interviewData.interviewId,
            questionIndex: currentQuestionIndex,
            answer: currentAnswer.content,
            format: currentAnswer.format || 'text',
          }),
        })

        // Also save to localStorage as backup
        localStorage.setItem('interviewAnswers', JSON.stringify(answers))
      } catch (error) {
        console.warn('Could not save answer to server:', error)
        // Save locally as fallback
        localStorage.setItem('interviewAnswers', JSON.stringify(answers))
      }
      return
    }

    // For authenticated interviews, save to server
    if (!sessionLockId || !interviewData) return

    try {
      await fetch(`http://localhost:9000/api/interview/session/${interviewData.sessionId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionLockId,
          currentQuestionIndex,
          answers,
          transcript: '',
        }),
      })
    } catch (error) {
      console.warn('Could not save progress to server:', error)
      // Save locally as fallback
      localStorage.setItem('interviewAnswers', JSON.stringify(answers))
    }
  }

  const handleSubmitAnswer = async () => {
    if (submitting || !interviewData) return

    // Safety check: prevent submission if question index is invalid
    const totalQuestions = interviewData.questions.length
    if (currentQuestionIndex >= totalQuestions) {
      console.error(`Invalid question index: ${currentQuestionIndex} >= ${totalQuestions}`)
      toast.error('Invalid interview state. Please refresh and try again.')
      return
    }

    setSubmitting(true)

    try {
      // Check if last question
      const isLastQuestion = currentQuestionIndex === totalQuestions - 1
      console.log(`Submitting answer: Q${currentQuestionIndex + 1}/${totalQuestions}, isLast=${isLastQuestion}`)
      
      if (isLastQuestion) {
        // All questions answered - save and transition
        localStorage.setItem('interviewAnswers', JSON.stringify(answers))

        // For mock interviews, complete via backend API
        if (isMockInterview) {
          try {
            // Save final answer
            const currentAnswer = answers[currentQuestionIndex]
            if (currentAnswer && currentAnswer.content) {
              await fetch(`${import.meta.env.VITE_API_URL}/mock/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  interviewId: interviewData.interviewId,
                  questionIndex: currentQuestionIndex,
                  answer: currentAnswer.content,
                  format: currentAnswer.format || 'text',
                }),
              })
            }

            // Complete interview
            const completeResponse = await fetch(
              `${import.meta.env.VITE_API_URL}/mock/complete/${interviewData.interviewId}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }
            )

            if (!completeResponse.ok) {
              throw new Error('Failed to complete interview')
            }

            const completeResult = await completeResponse.json()

            toast.success('Interview submitted successfully!', {
              position: 'top-right',
              autoClose: 1500,
            })

            // Navigate to mock results page
            setTimeout(() => {
              localStorage.setItem('mockInterviewResult', JSON.stringify(completeResult.data))
              navigate(`/mock-interview-result/${interviewData.interviewId}`)
            }, 1500)

            setSubmitting(false)
            return
          } catch (error) {
            console.error('Error completing mock interview:', error)
            toast.error('Error submitting interview: ' + error.message, {
              position: 'top-right',
              autoClose: 3000,
            })
          }
        }

        // For public mock interviews with callback
        if (isPublicMock && onComplete) {
          try {
            setSubmitting(true)
            
            // For public mock interviews, also save to backend if we have interviewId
            if (interviewData?.interviewId) {
              // ===== CRITICAL FIX: Submit ALL unanswered questions before completing =====
              const totalQuestions = interviewData.questions.length
              
              // Submit all answers that haven't been submitted yet
              for (let idx = 0; idx < totalQuestions; idx++) {
                const answer = answers[idx]
                if (answer && answer.content && answer.content.trim()) {
                  try {
                    await fetch(`${import.meta.env.VITE_API_URL}/mock/answer`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        interviewId: interviewData.interviewId,
                        questionIndex: idx,
                        answer: answer.content,
                        format: answer.type || answer.format || 'text',
                      }),
                    })
                    console.log(`Submitted answer for question ${idx + 1}`)
                  } catch (error) {
                    console.warn(`Failed to submit answer for question ${idx + 1}:`, error)
                    // Continue submitting other answers
                  }
                }
              }

              // Complete interview via backend
              const completeResponse = await fetch(
                `${import.meta.env.VITE_API_URL}/mock/complete/${interviewData.interviewId}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                }
              )

              if (!completeResponse.ok) {
                console.warn('Failed to complete interview on backend, continuing with local state')
              }
            }

            toast.success('Interview submitted successfully!', {
              position: 'top-right',
              autoClose: 1500,
            })
            
            // Save answers to localStorage for fallback
            localStorage.setItem('interviewAnswers', JSON.stringify(answers))
            
            setTimeout(() => {
              setSubmitting(false)
              onComplete()
            }, 1500)
            return
          } catch (error) {
            console.error('Error in public mock interview submission:', error)
            toast.warning('Interview submitted locally (backend sync failed)', {
              position: 'top-right',
              autoClose: 2000,
            })
            setSubmitting(false)
            onComplete()
            return
          }
        }

        // For authenticated interviews, submit to backend with retry
        try {
          setRetryingSubmission(false)

          await retryInterviewSubmission(
            async () => {
              const response = await fetch(
                `http://localhost:9000/api/interview/session/${interviewData.sessionId}/submit`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    interviewId: interviewData.sessionId,
                    sessionLockId,
                    jobRole: interviewData.jobRole,
                    experienceLevel: interviewData.experienceLevel,
                    questions: interviewData.questions.map((q, idx) => ({
                      question: q,
                      answer: answers[idx]?.content || '',
                    })),
                    interviewType: interviewData.interviewType,
                    difficultyLevel: interviewData.difficultyLevel,
                    answers: Object.entries(answers).reduce((acc, [idx, answer]) => {
                      acc[idx] = answer.content || ''
                      return acc
                    }, {}),
                  }),
                }
              )

              if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || 'Submission failed')
              }

              return response.json()
            },
            (message, isRetrying) => {
              if (isRetrying) {
                setRetryingSubmission(true)
                toast.info(message, {
                  position: 'top-right',
                  autoClose: 3000,
                })
              }
            }
          )

          toast.success('Interview submitted successfully!', {
            position: 'top-right',
            autoClose: 2000,
          })

          setTimeout(() => {
            navigate(`/interview/session/${token}/results`)
          }, 2000)
        } catch (error) {
          toast.error(
            error.message || 'Failed to submit interview. Please check your connection and try again.',
            {
              position: 'top-right',
              autoClose: 3000,
            }
          )
        }
      } else {
        // Move to next question
        await saveProgress()
        setCurrentQuestionIndex((prev) => prev + 1)
        setTimeLeft(300)
        setRecordedAnswer(null)
      }
    } catch (error) {
      toast.error('Failed to process answer', {
        position: 'top-right',
        autoClose: 3000,
      })
    } finally {
      setSubmitting(false)
      setRetryingSubmission(false)
    }
  }

  if (!interviewData || isResuming) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin" size={40} />
          <p className="text-gray-600">{isResuming ? 'Resuming interview...' : 'Loading interview...'}</p>
        </div>
      </div>
    )
  }

  // Safety check for questions data
  if (!interviewData.questions || !Array.isArray(interviewData.questions) || interviewData.questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Questions</h2>
          <p className="text-gray-600 mb-6">No questions were generated for this interview.</p>
          <button
            onClick={() => navigate('/mock-interview-setup')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  const progressPercentage = ((currentQuestionIndex + 1) / interviewData.questions.length) * 100
  const currentAnswer = answers[currentQuestionIndex]
  const currentQuestion = interviewData.questions[currentQuestionIndex]

  // ===== MOCK INTERVIEW: Professional AI-driven layout =====
  if (isMockInterview) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Fixed Header with Timer and Progress */}
        <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-50">
          <div className="max-w-full px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">Interview in Progress</h1>
                <p className="text-gray-400 text-sm">Question {currentQuestionIndex + 1} of {interviewData.questions.length}</p>
              </div>
              <div className={`text-3xl font-bold ${timeLeft <= 60 ? 'text-red-500' : 'text-blue-400'}`}>
                {formatTime(timeLeft)}
              </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-1">
              <div
                className="bg-gradient-to-r from-blue-600 to-blue-400 h-1 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Main Content Area - with margin for fixed header */}
        <div className="mt-24 grid grid-cols-12 gap-6 p-6 h-[calc(100vh-120px)]">
          {/* Left Side: AI Avatar */}
          <div className="col-span-3 bg-gradient-to-b from-blue-900 to-blue-800 rounded-lg p-6 flex flex-col items-center justify-center">
            <AIAvatar isSpeaking={isMockAISpeaking} />
          </div>

          {/* Center: Question and Answer */}
          <div className="col-span-6 flex flex-col gap-6 overflow-y-auto">
            {/* Question Display */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">{currentQuestion}</h2>
              <button
                onClick={() => {
                  setIsMockAISpeaking(true)
                  speakText(currentQuestion)
                  setTimeout(() => setIsMockAISpeaking(false), 3000)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
              >
                <Volume2 size={16} />
                Listen Again
              </button>
            </div>

            {/* Answer Section */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 flex-1 flex flex-col">
              {/* Answer Format Selector */}
              <div className="flex gap-3 mb-4 items-center">
                <button
                  onClick={() => setAnswerType('text')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    answerType === 'text'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => setAnswerType('voice')}
                  className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                    answerType === 'voice'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <Phone size={16} />
                  Voice (Recommended)
                </button>
                <span className="text-xs text-gray-400 ml-2">🎤 Answer using voice</span>
              </div>

              {/* Answer Input */}
              <div className="flex-1">
                {answerType === 'text' && (
                  <textarea
                    value={currentAnswer?.content || ''}
                    onChange={(e) => handleTextAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full h-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-600 focus:outline-none resize-none"
                    disabled={submitting}
                  />
                )}

                {answerType === 'voice' && (
                  <div className="space-y-3 h-full flex flex-col">
                    <VoiceRecorder 
                      onTranscript={handleVoiceAnswer}
                      onRecordingComplete={handleVoiceRecordingComplete}
                    />
                    {recordedAnswer && (
                      <div className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg overflow-y-auto">
                        <p className="text-sm text-gray-400 mb-2">Recorded transcript:</p>
                        <p className="text-gray-200">{recordedAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex((prev) => prev - 1)
                      setTimeLeft(300)
                      setRecordedAnswer(null)
                    }
                  }}
                  disabled={currentQuestionIndex === 0 || submitting}
                  className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center gap-2"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>

                {answerType === 'text' && (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={submitting || !currentAnswer}
                    className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader size={16} className="animate-spin" />
                        {retryingSubmission ? 'Retrying...' : 'Processing...'}
                      </span>
                    ) : currentQuestionIndex === interviewData.questions.length - 1 ? (
                      'Complete Interview'
                    ) : (
                      'Next Question'
                    )}
                  </button>
                )}

                {answerType === 'voice' && (
                  <div className="flex-1 flex items-center justify-between px-4 py-2 bg-green-900 text-green-200 rounded-lg text-sm font-medium gap-3">
                    <span>✓ Answer will submit automatically</span>
                    {recordedAnswer && (
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={submitting}
                        className="px-4 py-1 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition text-xs whitespace-nowrap"
                        title="Manually proceed to next question if auto-advance doesn't work"
                      >
                        {submitting ? 'Processing...' : 'Next Question'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Transcript Panel */}
          <div className="col-span-3 h-full">
            <TranscriptPanel transcript={mockTranscript} />
          </div>
        </div>
      </div>
    )
  }

  // ===== REAL INTERVIEW: Original layout (unchanged for backward compatibility) =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Fixed Header with Timer and Progress */}
        <div className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Interview in Progress</h1>
                <p className="text-gray-600">Question {currentQuestionIndex + 1} of {interviewData.questions.length}</p>
              </div>
              <div className={`text-3xl font-bold ${timeLeft <= 60 ? 'text-red-600' : 'text-indigo-600'}`}>
                {formatTime(timeLeft)}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Main Content - with margin to account for fixed header */}
        <div className="mt-32 space-y-6">
          {/* Retry Status Banner */}
          {retryingSubmission && (
            <div className="p-4 bg-orange-50 border border-orange-300 rounded-lg flex items-center gap-3">
              <AlertCircle className="text-orange-600" size={20} />
              <span className="text-orange-800 text-sm font-medium">
                Connection issue detected. Retrying submission...
              </span>
            </div>
          )}

          {/* Question Display */}
          <div className="bg-white rounded-lg shadow-lg p-8 select-none">
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex-1">{currentQuestion}</h2>
                <button
                  onClick={() => speakText(currentQuestion)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition font-medium text-sm whitespace-nowrap"
                  title="Read question aloud"
                >
                  <Volume2 size={18} />
                  Read Aloud
                </button>
              </div>
            </div>

            {/* Answer Format Selector */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Answer format:</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setAnswerType('text')}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    answerType === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => setAnswerType('voice')}
                  className={`px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                    answerType === 'voice'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Phone size={16} />
                  Voice
                </button>
              </div>
            </div>

            {/* Answer Input Section */}
            <div className="space-y-4 mb-8">
              {answerType === 'text' && (
                <textarea
                  value={currentAnswer?.content || ''}
                  onChange={(e) => handleTextAnswer(e.target.value)}
                  placeholder="Type your answer here... (minimum 5 characters)"
                  className="w-full h-48 p-4 border-2 border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none resize-none font-medium"
                  disabled={submitting}
                />
              )}

              {answerType === 'voice' && (
                <div className="space-y-4">
                  <VoiceRecorder 
                    onTranscript={handleVoiceAnswer}
                    onRecordingComplete={handleVoiceRecordingComplete}
                  />
                  {recordedAnswer && (
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">Recorded transcript:</p>
                      <p className="text-gray-900 leading-relaxed">{recordedAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Buttons - Only show Next Question button in Text mode */}
            <div className="flex gap-4 justify-between pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  if (currentQuestionIndex > 0) {
                    setCurrentQuestionIndex((prev) => prev - 1)
                    setTimeLeft(300)
                    setRecordedAnswer(null)
                  }
                }}
                disabled={currentQuestionIndex === 0 || submitting}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                  currentQuestionIndex === 0 || submitting
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <ChevronLeft size={18} />
                Previous
              </button>

              {/* Next Question button - Only show in Text mode */}
              {answerType === 'text' && (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={submitting || !currentAnswer}
                  className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition ${
                    submitting || !currentAnswer
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      {retryingSubmission ? 'Retrying...' : 'Processing...'}
                    </>
                  ) : currentQuestionIndex === interviewData.questions.length - 1 ? (
                    <>
                      Complete Interview
                      <SkipForward size={18} />
                    </>
                  ) : (
                    <>
                      Next Question
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              )}

              {/* Voice mode message - Show when in Voice mode */}
              {answerType === 'voice' && (
                <div className="flex-1 flex items-center justify-between gap-3">
                  <div className="px-6 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium text-sm flex-1">
                    Answer will submit automatically after recording
                  </div>
                  {recordedAnswer && (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={submitting}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition flex items-center gap-2"
                      title="Manually proceed to next question if auto-advance doesn't work"
                    >
                      {submitting ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Processing...
                        </>
                      ) : currentQuestionIndex === interviewData.questions.length - 1 ? (
                        <>
                          Complete <SkipForward size={16} />
                        </>
                      ) : (
                        <>
                          Next <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Character Count for Text Answer */}
          {answerType === 'text' && (
            <div className="text-right text-sm text-gray-600">
              {(currentAnswer?.content || '').length} characters
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicInterviewScreen
