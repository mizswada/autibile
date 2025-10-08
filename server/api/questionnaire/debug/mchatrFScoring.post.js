// Debug endpoint to trace MCHATR-F scoring issues
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) {
      return {
        statusCode: 400,
        message: "Answers array is required"
      };
    }

    console.log('🔍 Debugging MCHATR-F scoring with input:', JSON.stringify(answers, null, 2));

    // Group answers by question
    const answersByQuestion = {};
    answers.forEach(answer => {
      const questionId = answer.question_id;
      if (!answersByQuestion[questionId]) {
        answersByQuestion[questionId] = [];
      }
      answersByQuestion[questionId].push(answer);
    });

    const debugResults = [];

    // Process each question with detailed debugging
    for (const [questionId, questionAnswers] of Object.entries(answersByQuestion)) {
      console.log(`\n📋 Processing Question ${questionId}:`);
      console.log('Raw answers:', JSON.stringify(questionAnswers, null, 2));

      // Separate answers into 0-value and 1-value groups
      const zeroValueAnswers = questionAnswers.filter(answer => {
        const isZero = answer.option_value === 0 || answer.option_value === '0';
        console.log(`Answer ${answer.option_id}: option_value=${answer.option_value}, isZero=${isZero}`);
        return isZero;
      });
      
      const oneValueAnswers = questionAnswers.filter(answer => {
        const isOne = answer.option_value === 1 || answer.option_value === '1';
        console.log(`Answer ${answer.option_id}: option_value=${answer.option_value}, isOne=${isOne}`);
        return isOne;
      });

      console.log(`Zero value answers: ${zeroValueAnswers.length}`);
      console.log(`One value answers: ${oneValueAnswers.length}`);

      const hasZeroValue = zeroValueAnswers.length > 0;
      const hasOneValue = oneValueAnswers.length > 0;

      console.log(`Has zero value: ${hasZeroValue}`);
      console.log(`Has one value: ${hasOneValue}`);

      let score = 0;
      let logic = "";

      // Apply MCHATR-F Decision Tree Logic with detailed logging
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

      debugResults.push({
        question_id: parseInt(questionId),
        raw_answers: questionAnswers,
        zero_value_answers: zeroValueAnswers,
        one_value_answers: oneValueAnswers,
        zero_count: zeroValueAnswers.length,
        one_count: oneValueAnswers.length,
        has_zero_value: hasZeroValue,
        has_one_value: hasOneValue,
        final_score: score,
        logic: logic,
        debug_info: {
          all_option_values: questionAnswers.map(a => a.option_value),
          option_value_types: questionAnswers.map(a => typeof a.option_value),
          strict_zero_check: questionAnswers.map(a => a.option_value === 0),
          strict_one_check: questionAnswers.map(a => a.option_value === 1),
          loose_zero_check: questionAnswers.map(a => a.option_value == 0),
          loose_one_check: questionAnswers.map(a => a.option_value == 1)
        }
      });
    }

    return {
      statusCode: 200,
      message: "MCHATR-F scoring debug completed",
      data: {
        input_answers: answers,
        debug_results: debugResults,
        summary: {
          total_questions: debugResults.length,
          questions_scored_0: debugResults.filter(r => r.final_score === 0).length,
          questions_scored_1: debugResults.filter(r => r.final_score === 1).length,
          total_score: debugResults.reduce((sum, r) => sum + r.final_score, 0)
        }
      }
    };

  } catch (error) {
    console.error("Error in MCHATR-F scoring debug:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});
