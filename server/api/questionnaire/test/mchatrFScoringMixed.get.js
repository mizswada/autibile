// Test endpoint to verify MCHATR-F scoring with real data structure
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { testData } = query;

    // Simulate the exact data structure you're seeing
    const testAnswers = [
      {
        "question_id": 21,
        "option_id": 41,
        "option_value": 0,
        "patient_id": 54,
        "parentID": null,
        "mchatr_id": 1
      },
      {
        "question_id": 21,
        "option_id": 42,
        "option_value": 1,
        "patient_id": 54,
        "parentID": null,
        "mchatr_id": 1
      },
      {
        "question_id": 21,
        "option_id": 43,
        "option_value": 1,
        "patient_id": 54,
        "parentID": null,
        "mchatr_id": 1
      },
      {
        "question_id": 21,
        "option_id": 44,
        "option_value": 1,
        "patient_id": 54,
        "parentID": null,
        "mchatr_id": 1
      }
    ];

    console.log('🧪 Testing MCHATR-F scoring with mixed answers:');
    console.log('Input:', JSON.stringify(testAnswers, null, 2));

    // Group answers by question
    const answersByQuestion = {};
    testAnswers.forEach(answer => {
      const questionId = answer.question_id;
      if (!answersByQuestion[questionId]) {
        answersByQuestion[questionId] = [];
      }
      answersByQuestion[questionId].push(answer);
    });

    console.log('Grouped by question:', JSON.stringify(answersByQuestion, null, 2));

    const results = [];
    let totalScore = 0;

    // Process each question
    for (const [questionId, questionAnswers] of Object.entries(answersByQuestion)) {
      console.log(`\n--- Processing Question ${questionId} ---`);
      console.log('Question answers:', JSON.stringify(questionAnswers, null, 2));

      // Separate by option_value
      const zeroValueAnswers = questionAnswers.filter(answer => {
        const value = answer.option_value;
        const isZero = value === 0 || value === '0' || value === '0.0';
        console.log(`Answer ${answer.option_id}: option_value=${value} (${typeof value}), isZero=${isZero}`);
        return isZero;
      });

      const oneValueAnswers = questionAnswers.filter(answer => {
        const value = answer.option_value;
        const isOne = value === 1 || value === '1' || value === '1.0';
        console.log(`Answer ${answer.option_id}: option_value=${value} (${typeof value}), isOne=${isOne}`);
        return isOne;
      });

      const hasZeroValue = zeroValueAnswers.length > 0;
      const hasOneValue = oneValueAnswers.length > 0;

      console.log(`Zero value answers: ${zeroValueAnswers.length}`);
      console.log(`One value answers: ${oneValueAnswers.length}`);
      console.log(`Has zero value: ${hasZeroValue}`);
      console.log(`Has one value: ${hasOneValue}`);

      let score = 0;
      let logic = "";

      if (hasZeroValue && !hasOneValue) {
        score = 0;
        logic = "Yes only to 0 example(s) → Score = 0";
        console.log('✅ Case 1: Only 0-value answers');
      } else if (!hasZeroValue && hasOneValue) {
        score = 1;
        logic = "Yes only to 1 example(s) → Score = 1";
        console.log('✅ Case 2: Only 1-value answers');
      } else if (hasZeroValue && hasOneValue) {
        console.log('✅ Case 3: Both 0-value and 1-value answers');
        console.log(`Comparing: ${oneValueAnswers.length} vs ${zeroValueAnswers.length}`);
        
        if (oneValueAnswers.length > zeroValueAnswers.length) {
          score = 1;
          logic = `Yes to both 0 and 1 example(s) → More 1-value (${oneValueAnswers.length} > ${zeroValueAnswers.length}) → Score = 1`;
          console.log('More 1-value answers → Score = 1');
        } else if (zeroValueAnswers.length > oneValueAnswers.length) {
          score = 0;
          logic = `Yes to both 0 and 1 example(s) → More 0-value (${zeroValueAnswers.length} > ${oneValueAnswers.length}) → Score = 0`;
          console.log('More 0-value answers → Score = 0');
        } else {
          score = 0;
          logic = `Yes to both 0 and 1 example(s) → Equal counts (${oneValueAnswers.length} = ${zeroValueAnswers.length}) → Score = 0`;
          console.log('Equal counts → Score = 0 (default)');
        }
      } else {
        score = 0;
        logic = "No answers selected → Score = 0";
        console.log('❌ No answers selected');
      }

      console.log(`Final score for question ${questionId}: ${score}`);

      results.push({
        question_id: parseInt(questionId),
        score: score,
        logic: logic,
        zero_count: zeroValueAnswers.length,
        one_count: oneValueAnswers.length,
        answers: questionAnswers
      });

      totalScore += score;
      console.log(`Running total: ${totalScore}`);
    }

    console.log(`\n🎯 FINAL TOTAL SCORE: ${totalScore}`);

    // Determine result interpretation
    let resultInterpretation = "";
    let resultStatus = "";
    
    if (totalScore >= 0 && totalScore <= 1) {
      resultInterpretation = "Negative - Low risk for autism spectrum disorder";
      resultStatus = "Negative";
    } else if (totalScore >= 2) {
      resultInterpretation = "Positive - High risk for autism spectrum disorder, further evaluation recommended";
      resultStatus = "Positive";
    } else {
      resultInterpretation = "Invalid score";
      resultStatus = "Invalid";
    }

    console.log(`📋 RESULT: ${resultStatus} (${resultInterpretation})`);

    return {
      statusCode: 200,
      message: "MCHATR-F scoring test completed",
      data: {
        input_answers: testAnswers,
        grouped_answers: answersByQuestion,
        results: results,
        total_score: totalScore,
        result_interpretation: {
          status: resultStatus,
          interpretation: resultInterpretation,
          score_range: totalScore >= 0 && totalScore <= 1 ? "0-1" : "2+",
          recommendation: totalScore >= 2 ? 
            "Further evaluation recommended" : 
            "Continue routine developmental monitoring"
        },
        summary: {
          total_questions: results.length,
          questions_scored_0: results.filter(r => r.score === 0).length,
          questions_scored_1: results.filter(r => r.score === 1).length,
          final_total_score: totalScore,
          result_status: resultStatus
        }
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
