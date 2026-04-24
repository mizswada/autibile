export default defineEventHandler(async (event) => {
  const { user } = event.context
  if (!user) {
    return {
      statusCode: 401,
      message: 'Unauthorized'
    }
  }

  try {
    const testPrompt = {
      questionnaireName: 'Test Questionnaire',
      totalScore: 5,
      scoreMin: 0,
      scoreMax: 10,
      thresholdInterpretation: 'Medium Risk',
      answers: [
        { question: 'Test question 1?', answer: 'Yes' },
        { question: 'Test question 2?', answer: 'No' }
      ]
    }

    const result = await getAIAnalysisResult(testPrompt)

    if (!result.ok) {
      return {
        statusCode: 400,
        message: result.message
      }
    }

    return {
      statusCode: 200,
      message: 'Connection successful',
      data: {
        success: true,
        response: {
          result: result.data.result,
          explanation: result.data.explanation
        }
      }
    }
  } catch (error) {
    console.error('Test AI connection failed:', error)
    return {
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }
})
