// Test endpoint for MCHATR-F scoring logic
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { testCase } = query;

    // Test cases to demonstrate the scoring logic
    const testCases = {
      case1: {
        name: "Yes only to 0 example(s)",
        answers: [
          { question_id: 1, option_id: 1, option_value: 0 },
          { question_id: 1, option_id: 2, option_value: 0 }
        ],
        expectedScore: 0,
        description: "Only typical behaviors selected"
      },
      case2: {
        name: "Yes only to 1 example(s)",
        answers: [
          { question_id: 1, option_id: 3, option_value: 1 },
          { question_id: 1, option_id: 4, option_value: 1 }
        ],
        expectedScore: 1,
        description: "Only atypical behaviors selected"
      },
      case3: {
        name: "Yes to both 0 and 1 example(s) - More 0-value",
        answers: [
          { question_id: 1, option_id: 1, option_value: 0 },
          { question_id: 1, option_id: 2, option_value: 0 },
          { question_id: 1, option_id: 3, option_value: 1 }
        ],
        expectedScore: 0,
        description: "More typical behaviors than atypical"
      },
      case4: {
        name: "Yes to both 0 and 1 example(s) - More 1-value",
        answers: [
          { question_id: 1, option_id: 1, option_value: 0 },
          { question_id: 1, option_id: 3, option_value: 1 },
          { question_id: 1, option_id: 4, option_value: 1 }
        ],
        expectedScore: 1,
        description: "More atypical behaviors than typical"
      },
      case5: {
        name: "Yes to both 0 and 1 example(s) - Equal counts",
        answers: [
          { question_id: 1, option_id: 1, option_value: 0 },
          { question_id: 1, option_id: 3, option_value: 1 }
        ],
        expectedScore: 0,
        description: "Equal counts - defaults to typical behavior"
      },
      case6: {
        name: "No answers selected",
        answers: [],
        expectedScore: 0,
        description: "No answers - defaults to 0"
      }
    };

    // If specific test case requested
    if (testCase && testCases[testCase]) {
      const test = testCases[testCase];
      const score = calculateMchatrFQuestionScore(1, test.answers);
      const explanation = getScoringLogicExplanation(1, test.answers, score);
      
      return {
        statusCode: 200,
        message: `Test case: ${test.name}`,
        data: {
          testCase: testCase,
          testName: test.name,
          description: test.description,
          inputAnswers: test.answers,
          expectedScore: test.expectedScore,
          actualScore: score,
          correct: score === test.expectedScore,
          explanation: explanation
        }
      };
    }

    // Run all test cases
    const results = [];
    for (const [caseKey, test] of Object.entries(testCases)) {
      const score = calculateMchatrFQuestionScore(1, test.answers);
      const explanation = getScoringLogicExplanation(1, test.answers, score);
      
      results.push({
        testCase: caseKey,
        testName: test.name,
        description: test.description,
        inputAnswers: test.answers,
        expectedScore: test.expectedScore,
        actualScore: score,
        correct: score === test.expectedScore,
        explanation: explanation
      });
    }

    const passedTests = results.filter(r => r.correct).length;
    const totalTests = results.length;

    return {
      statusCode: 200,
      message: `MCHATR-F Scoring Tests: ${passedTests}/${totalTests} passed`,
      data: {
        summary: {
          totalTests: totalTests,
          passedTests: passedTests,
          failedTests: totalTests - passedTests,
          successRate: `${Math.round((passedTests / totalTests) * 100)}%`
        },
        testResults: results
      }
    };

  } catch (error) {
    console.error("Error in MCHATR-F scoring test:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});

// Copy the scoring functions from the main API
function calculateMchatrFQuestionScore(questionId, answers) {
  const zeroValueAnswers = answers.filter(answer => answer.option_value === 0);
  const oneValueAnswers = answers.filter(answer => answer.option_value === 1);
  
  const hasZeroValue = zeroValueAnswers.length > 0;
  const hasOneValue = oneValueAnswers.length > 0;
  
  if (hasZeroValue && !hasOneValue) {
    return 0;
  } else if (!hasZeroValue && hasOneValue) {
    return 1;
  } else if (hasZeroValue && hasOneValue) {
    if (oneValueAnswers.length > zeroValueAnswers.length) {
      return 1;
    } else if (zeroValueAnswers.length > oneValueAnswers.length) {
      return 0;
    } else {
      return 0; // Equal counts - default to typical behavior
    }
  } else {
    return 0; // No answers selected
  }
}

function getScoringLogicExplanation(questionId, answers, finalScore) {
  const zeroValueAnswers = answers.filter(answer => answer.option_value === 0);
  const oneValueAnswers = answers.filter(answer => answer.option_value === 1);
  
  const hasZeroValue = zeroValueAnswers.length > 0;
  const hasOneValue = oneValueAnswers.length > 0;
  
  let logic = "";
  
  if (hasZeroValue && !hasOneValue) {
    logic = "Yes only to 0 example(s) → Score = 0";
  } else if (!hasZeroValue && hasOneValue) {
    logic = "Yes only to 1 example(s) → Score = 1";
  } else if (hasZeroValue && hasOneValue) {
    logic = `Yes to both 0 and 1 example(s) → More frequent: ${oneValueAnswers.length > zeroValueAnswers.length ? '1-value' : '0-value'} → Score = ${finalScore}`;
  } else {
    logic = "No answers selected → Score = 0";
  }
  
  return {
    logic: logic,
    zero_value_count: zeroValueAnswers.length,
    one_value_count: oneValueAnswers.length,
    final_score: finalScore
  };
}
