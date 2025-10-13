// MCHATR-F Scoring API - Implements the decision tree logic for questionnaire ID 2
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { answers, patientId, questionnaireId } = body;

    if (!answers || !Array.isArray(answers)) {
      return {
        statusCode: 400,
        message: "Answers array is required"
      };
    }

    if (parseInt(questionnaireId) !== 2) {
      return {
        statusCode: 400,
        message: "This scoring method is only for MCHATR-F (questionnaire ID 2)"
      };
    }

    console.log('🧮 Calculating MCHATR-F scores using decision tree logic');

    // Group answers by MCHAT-R question ID (mchatr_id) for MCHATR-F structure
    const answersByParentQuestion = {};
    answers.forEach(answer => {
      // All answers should be grouped by mchatr_id (the original MCHAT-R question)
      // Main questions and sub-questions both have mchatr_id pointing to MCHAT-R question
      const parentQuestionId = answer.mchatr_id || answer.question_id;
      
      console.log(`📝 Grouping answer: question_id=${answer.question_id}, mchatr_id=${answer.mchatr_id}, parentQuestionId=${parentQuestionId}, option_value=${answer.option_value}`);
      
      if (!answersByParentQuestion[parentQuestionId]) {
        answersByParentQuestion[parentQuestionId] = [];
      }
      answersByParentQuestion[parentQuestionId].push(answer);
    });

    const questionScores = [];
    let totalScore = 0;

    console.log(`\n📊 Processing ${Object.keys(answersByParentQuestion).length} main questions (grouped by mchatr_id):`);

    // Process each main question using MCHATR-F decision tree logic
    for (const [parentQuestionId, subQuestionAnswers] of Object.entries(answersByParentQuestion)) {
      console.log(`\n--- Main Question ${parentQuestionId} (mchatr_id) ---`);
      console.log(`Sub-questions: ${subQuestionAnswers.length} answers`);
      
      const score = calculateMchatrFQuestionScore(parentQuestionId, subQuestionAnswers);
      
      questionScores.push({
        parent_question_id: parseInt(parentQuestionId),
        score: score,
        sub_question_answers: subQuestionAnswers,
        scoring_logic: getScoringLogicExplanation(parentQuestionId, subQuestionAnswers, score)
      });
      
      totalScore += score;
      console.log(`Main Question ${parentQuestionId} score: ${score} | Running total: ${totalScore}`);
    }

    console.log(`\n🎯 FINAL TOTAL SCORE: ${totalScore}`);

    // Determine result interpretation
    let resultInterpretation = "";
    let resultStatus = "";
    let resultColor = "";
    
    if (totalScore >= 0 && totalScore <= 1) {
      resultInterpretation = "Negative - Low risk for autism spectrum disorder";
      resultStatus = "Negative";
      resultColor = "green";
    } else if (totalScore >= 2) {
      resultInterpretation = "Positive - High risk for autism spectrum disorder, further evaluation recommended";
      resultStatus = "Positive";
      resultColor = "red";
    } else {
      resultInterpretation = "Invalid score";
      resultStatus = "Invalid";
      resultColor = "gray";
    }

    console.log(`📋 RESULT: ${resultStatus} (${resultInterpretation})`);

    // Save the response to database - Always create new record for history tracking
    let qrRecord = null;
    if (patientId) {
      console.log(`\n💾 Creating new response record for patient ${patientId}, questionnaire ${questionnaireId}`);
      
      // Always create a new record to maintain submission history
      qrRecord = await prisma.questionnaires_responds.create({
        data: {
          questionnaire_id: parseInt(questionnaireId),
          patient_id: parseInt(patientId),
          total_score: totalScore,
          created_at: new Date()
        }
      });
      
      console.log(`✅ Created new response record (qr_id: ${qrRecord.qr_id}) - maintaining submission history`);

      // Save individual answers for this new submission
      console.log(`💾 Saving ${answers.length} individual answers for new submission qr_id: ${qrRecord.qr_id}`);
      
      const savedAnswers = await Promise.all(
        answers.map(async (answer) => {
          const savedAnswer = await prisma.questionnaires_questions_answers.create({
            data: {
              qr_id: qrRecord.qr_id,
              question_id: parseInt(answer.question_id),
              option_id: answer.option_id ? parseInt(answer.option_id) : null,
              score: answer.score || 0, // Store individual option scores
              text_answer: answer.text_answer || null,
              created_at: new Date()
            }
          });
          
          console.log(`  ✅ Saved answer: question_id=${answer.question_id}, option_id=${answer.option_id}, score=${answer.score || 0}`);
          return savedAnswer;
        })
      );
      
      console.log(`✅ Successfully saved ${savedAnswers.length} answers for submission history`);
    }

    return {
      statusCode: 200,
      message: "MCHATR-F scoring completed successfully - new submission saved to history",
      data: {
        questionnaire_id: parseInt(questionnaireId),
        patient_id: patientId ? parseInt(patientId) : null,
        total_score: totalScore,
        question_scores: questionScores,
        scoring_method: "MCHATR-F Decision Tree",
        response_id: qrRecord?.qr_id || null,
        result_interpretation: {
          status: resultStatus,
          interpretation: resultInterpretation,
          color: resultColor,
          score_range: totalScore >= 0 && totalScore <= 1 ? "0-1" : "2+",
          recommendation: totalScore >= 2 ? 
            "Further evaluation recommended" : 
            "Continue routine developmental monitoring"
        },
        summary: {
          total_questions: questionScores.length,
          questions_scored_0: questionScores.filter(q => q.score === 0).length,
          questions_scored_1: questionScores.filter(q => q.score === 1).length,
          final_total_score: totalScore,
          result_status: resultStatus
        }
      }
    };

  } catch (error) {
    console.error("Error in MCHATR-F scoring:", error);
    return {
      statusCode: 500,
      message: "Internal server error",
      error: error.message
    };
  }
});

// MCHATR-F Decision Tree Scoring Logic
function calculateMchatrFQuestionScore(parentQuestionId, subQuestionAnswers) {
  console.log(`\n🧮 Calculating score for Main Question ${parentQuestionId}:`);
  console.log(`📋 Sub-question answers:`, JSON.stringify(subQuestionAnswers, null, 2));
  
  // Separate sub-question answers into 0-value and 1-value groups
  const zeroValueAnswers = subQuestionAnswers.filter(answer => {
    const value = answer.option_value;
    const isZero = value === 0 || value === '0' || value === '0.0';
    console.log(`  Sub-question ${answer.question_id} (option ${answer.option_id}): option_value=${value} (${typeof value}), isZero=${isZero}`);
    return isZero;
  });
  
  const oneValueAnswers = subQuestionAnswers.filter(answer => {
    const value = answer.option_value;
    const isOne = value === 1 || value === '1' || value === '1.0';
    console.log(`  Sub-question ${answer.question_id} (option ${answer.option_id}): option_value=${value} (${typeof value}), isOne=${isOne}`);
    return isOne;
  });
  
  const hasZeroValue = zeroValueAnswers.length > 0;
  const hasOneValue = oneValueAnswers.length > 0;
  
  console.log(`\n📊 Decision Tree Analysis for Main Question ${parentQuestionId}:`);
  console.log(`  Zero-value sub-questions: ${zeroValueAnswers.length}`);
  console.log(`  One-value sub-questions: ${oneValueAnswers.length}`);
  console.log(`  Has zero-value answers: ${hasZeroValue}`);
  console.log(`  Has one-value answers: ${hasOneValue}`);
  
  // Apply MCHATR-F Decision Tree Logic
  if (hasZeroValue && !hasOneValue) {
    console.log(`\n✅ DECISION: Case 1 - Yes only to 0 example(s)`);
    console.log(`   → Main Question ${parentQuestionId} Score = 0`);
    return 0;
  } else if (!hasZeroValue && hasOneValue) {
    console.log(`\n✅ DECISION: Case 2 - Yes only to 1 example(s)`);
    console.log(`   → Main Question ${parentQuestionId} Score = 1`);
    return 1;
  } else if (hasZeroValue && hasOneValue) {
    console.log(`\n✅ DECISION: Case 3 - Yes to both 0 and 1 example(s)`);
    console.log(`   Comparing: ${oneValueAnswers.length} one-value vs ${zeroValueAnswers.length} zero-value`);
    console.log(`   Detailed comparison: oneValueAnswers.length=${oneValueAnswers.length}, zeroValueAnswers.length=${zeroValueAnswers.length}`);
    console.log(`   Comparison result: oneValueAnswers.length > zeroValueAnswers.length = ${oneValueAnswers.length > zeroValueAnswers.length}`);
    
    if (oneValueAnswers.length > zeroValueAnswers.length) {
      console.log(`   → More 1-value answers (${oneValueAnswers.length} > ${zeroValueAnswers.length})`);
      console.log(`   → Main Question ${parentQuestionId} Score = 1`);
      return 1; // More atypical behaviors
    } else if (zeroValueAnswers.length > oneValueAnswers.length) {
      console.log(`   → More 0-value answers (${zeroValueAnswers.length} > ${oneValueAnswers.length})`);
      console.log(`   → Main Question ${parentQuestionId} Score = 0`);
      return 0; // More typical behaviors
    } else {
      console.log(`   → Equal counts (${oneValueAnswers.length} = ${zeroValueAnswers.length})`);
      console.log(`   → Default to typical behavior`);
      console.log(`   → Main Question ${parentQuestionId} Score = 0`);
      return 0; // Equal counts - default to typical behavior
    }
  } else {
    console.log(`\n❌ DECISION: No sub-question answers selected`);
    console.log(`   → Main Question ${parentQuestionId} Score = 0`);
    return 0; // No answers selected
  }
}

// Get explanation of scoring logic for debugging
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
    const moreFrequent = oneValueAnswers.length > zeroValueAnswers.length ? '1-value' : '0-value';
    logic = `Yes to both 0 and 1 example(s) → More frequent: ${moreFrequent} → Score = ${finalScore}`;
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
