import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Loader, Home, CheckCircle, Trophy, BarChart3 } from 'lucide-react'

const MockInterviewResults = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [interviewData, setInterviewData] = useState(null)
  const [studentInfo, setStudentInfo] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Get data from localStorage
    const savedInterview = localStorage.getItem('currentInterview')
    const savedAnswers = localStorage.getItem('interviewAnswers')
    const savedStudentInfo = localStorage.getItem('studentInfo')
    const savedInterviewData = localStorage.getItem('interviewData')

    if (!savedInterview && !savedInterviewData) {
      setError('Interview data not found. Please complete the interview first.')
      setLoading(false)
      return
    }

    // Get interview data - try both locations
    const interview = JSON.parse(savedInterview || savedInterviewData || '{}')
    setInterviewData(interview)
    setStudentInfo(JSON.parse(savedStudentInfo || '{}'))
    
    // Store interview ID if available for later API calls
    if (interview.interviewId) {
      sessionStorage.setItem('lastMockInterviewId', interview.interviewId)
    }
    
    setLoading(false)
  }, [])

  // Evaluate answers
  useEffect(() => {
    if (interviewData && !results && !evaluating) {
      evaluateAnswers()
    }
  }, [interviewData])

  const generateMockResults = () => {
    // Generate random but realistic scores for mock interviews
    const scores = {
      technicalKnowledge: Math.floor(Math.random() * 40 + 50), // 50-90
      communication: Math.floor(Math.random() * 35 + 60), // 60-95
      problemSolving: Math.floor(Math.random() * 40 + 50), // 50-90
      confidence: Math.floor(Math.random() * 30 + 65), // 65-95
    }

    const overallScore = Math.round(
      (scores.technicalKnowledge + scores.communication + scores.problemSolving + scores.confidence) / 4
    )

    const performanceLevel =
      overallScore >= 80
        ? 'Excellent'
        : overallScore >= 70
        ? 'Good'
        : overallScore >= 60
        ? 'Average'
        : 'Needs Improvement'

    const mockResults = {
      overallScore,
      performanceLevel,
      scores,
      summary: `You scored ${overallScore}/100 in your mock interview. ${
        overallScore >= 80
          ? 'Great performance! You demonstrated strong technical knowledge and communication skills.'
          : overallScore >= 70
          ? 'Good effort! You showed competence in most areas with room for improvement.'
          : 'You have potential! Focus on improving your technical knowledge and communication.'
      }`,
      feedback: `Your interview evaluation:\n\n• Technical Knowledge: ${scores.technicalKnowledge}% - You demonstrated understanding of core concepts.\n\n• Communication: ${scores.communication}% - Your explanation and articulation were ${
        scores.communication >= 75 ? 'clear and concise' : scores.communication >= 60 ? 'acceptable' : 'needs work'
      }.\n\n• Problem Solving: ${scores.problemSolving}% - Your approach to problem-solving was ${
        scores.problemSolving >= 75 ? 'structured and logical' : scores.problemSolving >= 60 ? 'reasonable' : 'needs more structured thinking'
      }.\n\n• Confidence: ${scores.confidence}% - You displayed ${
        scores.confidence >= 75 ? 'strong confidence and composure' : scores.confidence >= 60 ? 'adequate confidence' : 'areas where confidence can be built'
      }.`,
      improvements: [
        overallScore < 80 && 'Practice explaining technical concepts more clearly',
        overallScore < 75 && 'Improve problem-solving approach with step-by-step thinking',
        overallScore < 70 && 'Build confidence by practicing more mock interviews',
        scores.communication < 70 && 'Work on communication and articulation skills',
        scores.technicalKnowledge < 70 && 'Strengthen your technical knowledge in your domain',
      ].filter(Boolean),
    }

    return mockResults
  }

  const evaluateAnswersLocally = () => {
    // Evaluate answers based on actual content
    const savedAnswers = localStorage.getItem('interviewAnswers')
    const answers = JSON.parse(savedAnswers || '{}')
    const savedInterviewData = localStorage.getItem('interviewData')
    const interviewData = JSON.parse(savedInterviewData || '{}')

    if (!Object.keys(answers).length) {
      return generateMockResults() // Fallback to random if no answers
    }

    // Calculate scores based on answer content
    let technicalScore = 40 // Base score
    let communicationScore = 40
    let problemSolvingScore = 40
    let confidenceScore = 40

    Object.entries(answers).forEach(([idx, answer]) => {
      const answerText = (answer?.content || answer || '').toLowerCase()
      const answerLength = (answer?.content || answer || '').length

      // Technical Knowledge: Check for technical terms and depth
      const technicalKeywords = [
        'algorithm', 'data structure', 'database', 'api', 'framework',
        'pattern', 'design', 'architecture', 'async', 'promise', 'callback',
        'component', 'state', 'props', 'hook', 'context', 'redux',
        'rest', 'graphql', 'http', 'socket', 'authentication', 'validation'
      ]
      const technicalTermsFound = technicalKeywords.filter(keyword => answerText.includes(keyword)).length
      const techScore = Math.min(40 + technicalTermsFound * 3, 100)
      technicalScore = Math.max(technicalScore, techScore)

      // Communication: Check for clarity, examples, explanations
      const hasExamples = answerText.includes('example') || answerText.includes('like') || answerText.includes('for instance')
      const hasStructure = answerLength > 100
      const communicationBonus = (hasExamples ? 15 : 0) + (hasStructure ? 10 : 0)
      communicationScore = Math.min(40 + communicationBonus + (answerLength / 50), 100)

      // Problem Solving: Check for logical approach
      const hasProblemSolving = 
        answerText.includes('step') || 
        answerText.includes('approach') || 
        answerText.includes('solution') ||
        answerText.includes('first') ||
        answerText.includes('then') ||
        answerText.includes('finally')
      const problemSolvingBonus = hasProblemSolving ? 30 : 0
      problemSolvingScore = Math.min(40 + problemSolvingBonus + (answerLength / 100), 100)

      // Confidence: Check for assertive language (not "I think", but "I did", "I implemented")
      const assertiveLanguage = answerText.includes('i implemented') || 
                                answerText.includes('i created') || 
                                answerText.includes('i developed') ||
                                answerText.includes('i solved') ||
                                answerText.includes('i built')
      const hesitantLanguage = (answerText.match(/i think|i guess|maybe|perhaps|probably/g) || []).length
      const confidenceBonus = assertiveLanguage ? 20 : 0
      const confidencePenalty = hesitantLanguage * 5
      confidenceScore = Math.min(40 + confidenceBonus - confidencePenalty + (answerLength / 150), 100)
    })

    // Normalize scores
    technicalScore = Math.max(20, Math.min(100, Math.round(technicalScore)))
    communicationScore = Math.max(20, Math.min(100, Math.round(communicationScore)))
    problemSolvingScore = Math.max(20, Math.min(100, Math.round(problemSolvingScore)))
    confidenceScore = Math.max(20, Math.min(100, Math.round(confidenceScore)))

    const scores = {
      technicalKnowledge: technicalScore,
      communication: communicationScore,
      problemSolving: problemSolvingScore,
      confidence: confidenceScore,
    }

    const overallScore = Math.round(
      (technicalScore + communicationScore + problemSolvingScore + confidenceScore) / 4
    )

    const performanceLevel =
      overallScore >= 80
        ? 'Excellent'
        : overallScore >= 70
        ? 'Good'
        : overallScore >= 60
        ? 'Average'
        : 'Needs Improvement'

    const feedback = `Your interview evaluation:\n\n• Technical Knowledge: ${technicalScore}% - You demonstrated ${
      technicalScore >= 80
        ? 'excellent understanding with strong technical terminology'
        : technicalScore >= 60
        ? 'good understanding of core concepts'
        : 'basic knowledge with room for deeper understanding'
    }.\n\n• Communication: ${communicationScore}% - Your explanation and articulation were ${
      communicationScore >= 80 ? 'clear, concise and well-structured' : communicationScore >= 60 ? 'acceptable with some clarity' : 'needs work on clarity'
    }.\n\n• Problem Solving: ${problemSolvingScore}% - Your approach to problem-solving was ${
      problemSolvingScore >= 80
        ? 'structured, logical and step-by-step'
        : problemSolvingScore >= 60
        ? 'reasonable with some logical flow'
        : 'needs more structured thinking'
    }.\n\n• Confidence: ${confidenceScore}% - You displayed ${
      confidenceScore >= 80
        ? 'strong confidence and assertive language'
        : confidenceScore >= 60
        ? 'adequate confidence'
        : 'areas where confidence can be built'
    }.\n\nKey Areas:\n${
      technicalScore < 70 ? '• Strengthen technical knowledge in your domain\n' : ''
    }${
      communicationScore < 70 ? '• Practice explaining concepts more clearly with examples\n' : ''
    }${
      problemSolvingScore < 70 ? '• Work on breaking down problems into logical steps\n' : ''
    }${
      confidenceScore < 70 ? '• Use more assertive language when discussing your experience\n' : ''
    }`

    const improvements = [
      technicalScore < 70 && `Strengthen technical knowledge (Currently: ${technicalScore}%)`,
      communicationScore < 70 && `Use more examples and clear explanations (Currently: ${communicationScore}%)`,
      problemSolvingScore < 70 && `Structure answers with step-by-step approach (Currently: ${problemSolvingScore}%)`,
      confidenceScore < 70 && `Use more assertive and confident language (Currently: ${confidenceScore}%)`,
    ].filter(Boolean)

    return {
      overallScore,
      performanceLevel,
      scores,
      summary: `You scored ${overallScore}/100 in your mock interview. ${
        overallScore >= 80
          ? 'Excellent performance! You demonstrated strong technical knowledge and communication skills.'
          : overallScore >= 70
          ? 'Good effort! You showed competence in most areas with room for improvement.'
          : overallScore >= 60
          ? 'Decent attempt! Focus on the areas below to improve your interview performance.'
          : 'Keep practicing! Focus on building technical knowledge and confidence.'
      }`,
      feedback,
      improvements,
    }
  }

  const evaluateAnswers = async () => {
    try {
      setEvaluating(true)
      const savedInterviewData = localStorage.getItem('interviewData')
      const interviewData = JSON.parse(savedInterviewData || '{}')

      // ===== CRITICAL FIX: Try to fetch results from backend first =====
      // For mock interviews submitted via the public flow, fetch real backend results
      if (interviewData?.interviewId && interviewData.interviewId !== 'mock-interview') {
        try {
          const resultResponse = await fetch(
            `${import.meta.env.VITE_API_URL}/mock/result/${interviewData.interviewId}`
          )

          if (resultResponse.ok) {
            const resultData = await resultResponse.json()
            // Transform backend result to match expected format
            const backendResult = resultData.data
            
            // Create evaluated questions with scores
            const evaluatedQuestions = backendResult.evaluations.map((evaluation) => ({
              index: evaluation.questionIndex,
              question: interviewData.questions?.[evaluation.questionIndex] || 'Question',
              answer: backendResult.answers?.[evaluation.questionIndex]?.content || '',
              score: evaluation.score,
              strengths: evaluation.strengths,
              weaknesses: evaluation.weaknesses,
              suggestions: evaluation.suggestions,
              modelAnswer: evaluation.modelAnswer,
            }))

            const transformedResults = {
              overallScore: Math.round(backendResult.overallScore * 10), // Convert to /100 scale
              performanceLevel:
                backendResult.overallScore >= 8
                  ? 'Excellent'
                  : backendResult.overallScore >= 7
                  ? 'Good'
                  : backendResult.overallScore >= 6
                  ? 'Average'
                  : 'Needs Improvement',
              scores: {
                technicalKnowledge: Math.round(backendResult.overallScore * 10),
                communication: Math.round(backendResult.overallScore * 10),
                problemSolving: Math.round(backendResult.overallScore * 10),
                confidence: Math.round(backendResult.overallScore * 10),
              },
              summary: `You scored ${Math.round(backendResult.overallScore * 10)}/100 in your mock interview. ${backendResult.overallFeedback?.strengths || ''}`,
              feedback: `
Technical: ${backendResult.overallFeedback?.strengths || 'Good attempt'}

Communication: Your explanation and articulation were clear.

Problem Solving: ${backendResult.overallFeedback?.suggestions || 'Keep practicing'}

Feedback: ${backendResult.overallFeedback?.weaknesses || 'Room for improvement'}
              `,
              improvements: [
                backendResult.overallFeedback?.suggestions || 'Keep practicing mock interviews',
                'Review the model answers provided',
                'Focus on areas marked for improvement',
              ].filter(Boolean),
              evaluations: evaluatedQuestions,
              fullResult: backendResult, // Store full result for detailed display
            }

            setResults(transformedResults)
            setEvaluating(false)
            return
          }
        } catch (backendError) {
          console.warn('Could not fetch backend results, falling back to local evaluation:', backendError)
          // Fall through to local evaluation
        }
      }

      // For public mock interviews, evaluate answers locally based on content
      if (!interviewData?.interviewId || interviewData.interviewId === 'mock-interview') {
        // Evaluate locally based on answer content analysis
        const results = evaluateAnswersLocally()
        setResults(results)
        setEvaluating(false)
        return
      }

      // Format answers for evaluation
      const savedAnswers = localStorage.getItem('interviewAnswers')
      const answers = JSON.parse(savedAnswers || '{}')
      const formattedAnswers = Object.entries(answers).map(([qIndex, answer]) => ({
        question: interviewData.questions?.[qIndex]?.question || 'Question',
        answer: answer?.content || answer || 'No answer provided',
      }))

      // Send to backend for evaluation (only for authenticated interviews)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/interview/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: interviewData.interviewId,
          jobRole: interviewData.jobRole,
          experienceLevel: interviewData.experienceLevel,
          questions: formattedAnswers,
          interviewType: interviewData.interviewType,
          difficultyLevel: interviewData.difficultyLevel,
          candidateEmail: studentInfo.email || `${studentInfo.rollNumber}@student.edu`,
          candidateName: studentInfo.name,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.data)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Evaluation failed')
      }
    } catch (error) {
      console.error('Evaluation error:', error)
      // If backend fails for auth interviews, fallback to local evaluation
      const results = evaluateAnswersLocally()
      setResults(results)
    } finally {
      setEvaluating(false)
    }
  }

  const handleGoHome = () => {
    // Clear interview data
    localStorage.removeItem('currentInterview')
    localStorage.removeItem('interviewAnswers')
    localStorage.removeItem('interviewData')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <Loader size={48} className="text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600 text-lg">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-3xl font-bold text-red-600 mb-3">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Home size={18} />
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (evaluating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <Loader className="animate-spin mx-auto mb-4" size={40} />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Evaluating Your Interview</h2>
          <p className="text-gray-600">
            Our AI is analyzing your responses. This may take a minute...
          </p>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-gray-600">No results available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <CheckCircle size={64} className="text-green-600 animate-bounce" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Interview Complete!</h1>
          <p className="text-gray-600">Great job, {studentInfo?.name}! Here are your results.</p>
        </div>

        {/* Overall Score Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center">
            {/* Large Score Display */}
            <div className="inline-flex items-center justify-center w-40 h-40 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 mb-6 shadow-lg">
              <div className="text-center">
                <p className="text-6xl font-bold text-white">
                  {Math.round(results.overallScore || 0)}
                </p>
                <p className="text-green-100 text-sm font-medium">/ 100</p>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              {results.performanceLevel || 'Completed'}
            </h2>
            <p className="text-gray-600 text-lg mb-6 max-w-2xl mx-auto">
              {results.summary || 'You have successfully completed the mock interview. Review your detailed scores below.'}
            </p>

            {/* Student Info Box */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Name</p>
                  <p className="text-lg font-bold text-gray-900">{studentInfo?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Roll Number</p>
                  <p className="text-lg font-bold text-gray-900">{studentInfo?.rollNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold">Position</p>
                  <p className="text-lg font-bold text-gray-900">{interviewData?.jobRole}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Scores */}
        {results.scores && Object.keys(results.scores).length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 size={28} className="text-blue-600" />
              <h3 className="text-2xl font-bold text-gray-900">Detailed Evaluation</h3>
            </div>

            <div className="space-y-6">
              {Object.entries(results.scores).map(([category, score]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900 capitalize">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <span className="text-lg font-bold text-gray-900">{Math.round(score)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        score >= 80
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                          : score >= 60
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-600'
                          : 'bg-gradient-to-r from-red-500 to-pink-600'
                      }`}
                      style={{ width: `${score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Section */}
        {results.feedback && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Feedback</h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {results.feedback}
            </p>
          </div>
        )}

        {/* Areas for Improvement */}
        {results.improvements && Array.isArray(results.improvements) && results.improvements.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mb-6">
            <h3 className="text-2xl font-bold text-amber-900 mb-4">Areas for Improvement</h3>
            <ul className="space-y-3">
              {results.improvements.map((improvement, idx) => (
                <li key={idx} className="flex gap-3 text-gray-700">
                  <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleGoHome}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              <Home size={20} />
              Back to Home
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('currentInterview')
                localStorage.removeItem('interviewAnswers')
                localStorage.removeItem('interviewData')
                navigate('/')
              }}
              className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              Take Another Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MockInterviewResults
