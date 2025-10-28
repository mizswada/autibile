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

    console.log('🧮 Calculating MCHATR-F scores using dynamic scoring methods');

    // Fetch ONLY the 7 main questions (mchatr_id 1-7) with their scoring configurations
    const mainQuestions = await prisma.questionnaires_questions.findMany({
      where: {
        questionnaire_id: 2,
        parentID: null, // Only main questions
        mchatr_id: { in: [1, 2, 3, 4, 5, 6, 7] }, // Only the 7 main MCHATR-F questions
        deleted_at: null
      },
      select: {
        question_id: true,
        mchatr_id: true,
        order: true,
        question_text_bi: true,
        scoring_method: true,
        scoring_config: true
      }
    });

    console.log(`📋 Found ${mainQuestions.length} main questions with scoring configurations`);

    // Group answers by MCHAT-R question ID (mchatr_id) for MCHATR-F structure
    // ONLY include answers that belong to the 7 main questions
    const answersByParentQuestion = {};
    const validMchatrIds = mainQuestions.map(q => q.mchatr_id);
    
    answers.forEach(answer => {
      // Only group answers that have a valid mchatr_id (1-7)
      if (!answer.mchatr_id || !validMchatrIds.includes(parseInt(answer.mchatr_id))) {
        // Skip this answer - it's a nested sub-question without valid mchatr_id
        return;
      }
      
      const parentQuestionId = answer.mchatr_id;
      
      console.log(`📝 Grouping answer: question_id=${answer.question_id}, mchatr_id=${answer.mchatr_id}, parentQuestionId=${parentQuestionId}, option_value=${answer.option_value}`);
      
      if (!answersByParentQuestion[parentQuestionId]) {
        answersByParentQuestion[parentQuestionId] = [];
      }
      answersByParentQuestion[parentQuestionId].push(answer);
    });

    const questionScores = [];
    let totalScore = 0;

    console.log(`\n📊 Processing ${Object.keys(answersByParentQuestion).length} main questions (grouped by mchatr_id):`);

    // Process each main question using its configured scoring method
    for (const [parentQuestionId, subQuestionAnswers] of Object.entries(answersByParentQuestion)) {
      console.log(`\n--- Main Question ${parentQuestionId} (mchatr_id) ---`);
      console.log(`Sub-questions: ${subQuestionAnswers.length} answers`);
      
      // Find the scoring configuration for this main question
      const mainQuestion = mainQuestions.find(q => q.mchatr_id === parseInt(parentQuestionId));
      const scoringMethod = mainQuestion?.scoring_method || 'decision_tree';
      const scoringConfig = mainQuestion?.scoring_config ? JSON.parse(mainQuestion.scoring_config) : {};
      
      console.log(`📊 Using scoring method: ${scoringMethod}`);
      
      const score = calculateQuestionScore(scoringMethod, scoringConfig, parentQuestionId, subQuestionAnswers);
      
      // Find the main question details for this mchatr_id
      const mainQuestionDetails = mainQuestions.find(q => q.mchatr_id === parseInt(parentQuestionId));
      
      questionScores.push({
        question_number: mainQuestionDetails?.order || parseInt(parentQuestionId),
        question_text: mainQuestionDetails?.question_text_bi || 'N/A',
        parent_question_id: parseInt(parentQuestionId),
        mchatr_id: parseInt(parentQuestionId),
        score: score,
        scoring_method: scoringMethod,
        sub_question_answers: subQuestionAnswers,
        scoring_logic: getScoringLogicExplanation(scoringMethod, parentQuestionId, subQuestionAnswers, score, scoringConfig)
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

// Dynamic Question Scoring - Routes to different methods based on configuration
function calculateQuestionScore(scoringMethod, scoringConfig, parentQuestionId, subQuestionAnswers) {
  console.log(`\n🧮 Calculating score for Main Question ${parentQuestionId}:`);
  console.log(`📊 Using method: ${scoringMethod}`);
  console.log(`📋 Sub-question answers:`, JSON.stringify(subQuestionAnswers, null, 2));
  
  switch(scoringMethod) {
    case 'decision_tree':
      return calculateDecisionTreeScore(parentQuestionId, subQuestionAnswers, scoringConfig);
    
    case 'or_logic':
    case 'any_yes':
      return calculateOrLogicScore(parentQuestionId, subQuestionAnswers, scoringConfig);
    
    case 'nested_conditional':
      return calculateNestedConditionalScore(parentQuestionId, subQuestionAnswers, scoringConfig);
    
    case 'simple_sum':
      return calculateSimpleSumScore(parentQuestionId, subQuestionAnswers, scoringConfig);
    
    case 'average_score':
      return calculateAverageScore(parentQuestionId, subQuestionAnswers, scoringConfig);
    
    case 'weighted_sum':
      return calculateWeightedSumScore(parentQuestionId, subQuestionAnswers, scoringConfig);
    
    default:
      console.log(`⚠️  Unknown scoring method: ${scoringMethod}, falling back to decision_tree`);
      return calculateDecisionTreeScore(parentQuestionId, subQuestionAnswers, scoringConfig);
  }
}

// Nested Conditional Scoring (for Question 5)
// Checks nested sub-questions to determine score based on frequency
function calculateNestedConditionalScore(parentQuestionId, subQuestionAnswers, config) {
  console.log(`\n📊 Nested Conditional Analysis for Main Question ${parentQuestionId}:`);
  
  // Filter answers by level
  const level1Answers = subQuestionAnswers.filter(a => !a.nested_level);
  const level2Answers = subQuestionAnswers.filter(a => a.nested_level === 2);
  const level3Answers = subQuestionAnswers.filter(a => a.nested_level === 3);
  
  console.log(`  Level 1 (sub-questions): ${level1Answers.length}`);
  console.log(`  Level 2 (nested): ${level2Answers.length}`);
  console.log(`  Level 3 (nested nested): ${level3Answers.length}`);
  
  // Check if any sub-question has score = 1
  const hasScore1Answer = level1Answers.some(answer => parseInt(answer.option_value) === 1);
  console.log(`  Has score=1 answer: ${hasScore1Answer}`);
  
  // If no score=1 answers, or no nested nested answers → Score = 0
  if (!hasScore1Answer || level3Answers.length === 0) {
    console.log(`\n✅ DECISION: No score=1 answers or no frequency question answered`);
    console.log(`   → Main Question ${parentQuestionId} Score = 0`);
    return 0;
  }
  
  // Check the frequency question (nested nested, level 3)
  // If any frequency answer is Yes (value=1) → Score = 1
  const hasFrequencyYes = level3Answers.some(answer => parseInt(answer.option_value) === 1);
  
  if (hasFrequencyYes) {
    console.log(`\n✅ DECISION: Score=1 answer selected AND frequency is Yes (more than twice a week)`);
    console.log(`   → Main Question ${parentQuestionId} Score = 1`);
    return 1;
  } else {
    console.log(`\n✅ DECISION: Score=1 answer selected BUT frequency is No (≤ twice a week)`);
    console.log(`   → Main Question ${parentQuestionId} Score = 0`);
    return 0;
  }
}

// OR Logic Scoring (for Question 2 and similar)
// Score = 1 if ANY sub-question has value = 1, Score = 0 if ALL sub-questions have value = 0
function calculateOrLogicScore(parentQuestionId, subQuestionAnswers, config) {
  console.log(`\n📊 OR Logic Analysis for Main Question ${parentQuestionId}:`);
  
  // Check if config says to include main question value (default: false - exclude main question)
  const includeMainQuestion = config?.include_main_question === true;
  
  // Filter based on config: if include_main_question is false (default), only count sub-questions
  let answersToProcess = includeMainQuestion 
    ? subQuestionAnswers 
    : subQuestionAnswers.filter(answer => answer.parentID !== null);
  
  // Hardcoded exclusion: Question 309 is special and should not be included in scoring
  answersToProcess = answersToProcess.filter(answer => answer.question_id !== 309);
  
  console.log(`  Include main question: ${includeMainQuestion}`);
  console.log(`  Total answers: ${subQuestionAnswers.length}, Processing: ${answersToProcess.length}`);
  
  let yesCount = 0;
  let noCount = 0;
  
  answersToProcess.forEach(answer => {
    const value = parseInt(answer.option_value) || 0;
    const isYes = value === 1;
    const answerType = answer.parentID === null ? 'MAIN QUESTION' : 'SUB-QUESTION';
    
    console.log(`  ${answerType} ${answer.question_id} (option ${answer.option_id}): option_value=${value}, isYes=${isYes}`);
    
    if (isYes) {
      yesCount++;
    } else {
      noCount++;
    }
  });
  
  console.log(`  Yes answers: ${yesCount}`);
  console.log(`  No answers: ${noCount}`);
  
  // If ANY answer (main question OR sub-question) is Yes → Score = 1
  // If ALL answers are No → Score = 0
  if (yesCount > 0) {
    console.log(`\n✅ DECISION: Yes to at least one answer`);
    console.log(`   → Main Question ${parentQuestionId} Score = 1`);
    return 1;
  } else {
    console.log(`\n✅ DECISION: No to all sub-questions`);
    console.log(`   → Main Question ${parentQuestionId} Score = 0`);
    return 0;
  }
}

// Decision Tree Scoring Logic (for Question 1)
function calculateDecisionTreeScore(parentQuestionId, subQuestionAnswers, config) {
  // Check if config says to include main question value
  const includeMainQuestion = config?.include_main_question === true;
  
  // Filter based on config: if include_main_question is true, keep all answers, otherwise only sub-questions
  const actualSubQuestions = includeMainQuestion 
    ? subQuestionAnswers 
    : subQuestionAnswers.filter(answer => answer.parentID !== null);
  
  console.log(`  Include main question: ${includeMainQuestion}`);
  console.log(`  Total answers: ${subQuestionAnswers.length}, Sub-question answers: ${actualSubQuestions.length}`);
  
  // Separate sub-question answers into 0-value and 1-value groups
  const zeroValueAnswers = actualSubQuestions.filter(answer => {
    const value = answer.option_value;
    const isZero = value === 0 || value === '0' || value === '0.0';
    console.log(`  Sub-question ${answer.question_id} (option ${answer.option_id}): option_value=${value} (${typeof value}), isZero=${isZero}`);
    return isZero;
  });
  
  const oneValueAnswers = actualSubQuestions.filter(answer => {
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
  
  // Apply Decision Tree Logic
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
    
    if (oneValueAnswers.length > zeroValueAnswers.length) {
      console.log(`   → More 1-value answers (${oneValueAnswers.length} > ${zeroValueAnswers.length})`);
      console.log(`   → Main Question ${parentQuestionId} Score = 1`);
      return 1;
    } else if (zeroValueAnswers.length > oneValueAnswers.length) {
      console.log(`   → More 0-value answers (${zeroValueAnswers.length} > ${oneValueAnswers.length})`);
      console.log(`   → Main Question ${parentQuestionId} Score = 0`);
      return 0;
    } else {
      console.log(`   → Equal counts (${oneValueAnswers.length} = ${zeroValueAnswers.length})`);
      console.log(`   → Default to typical behavior`);
      console.log(`   → Main Question ${parentQuestionId} Score = 0`);
      return 0;
    }
  } else {
    console.log(`\n❌ DECISION: No sub-question answers selected`);
    console.log(`   → Main Question ${parentQuestionId} Score = 0`);
    return 0;
  }
}

// Simple Sum Scoring
function calculateSimpleSumScore(parentQuestionId, subQuestionAnswers, config) {
  const sum = subQuestionAnswers.reduce((total, answer) => {
    const value = parseInt(answer.option_value) || 0;
    return total + value;
  }, 0);
  
  console.log(`📊 Simple Sum for Main Question ${parentQuestionId}: Sum = ${sum}`);
  
  const threshold = config.threshold || 1;
  const aboveThresholdScore = config.above_threshold_score || 1;
  const belowThresholdScore = config.below_threshold_score || 0;
  
  const score = sum >= threshold ? aboveThresholdScore : belowThresholdScore;
  console.log(`   → Score: ${score} (${sum >= threshold ? 'above' : 'below'} threshold ${threshold})`);
  
  return score;
}

// Average Score
function calculateAverageScore(parentQuestionId, subQuestionAnswers, config) {
  if (subQuestionAnswers.length === 0) return 0;
  
  const sum = subQuestionAnswers.reduce((total, answer) => {
    const value = parseFloat(answer.option_value) || 0;
    return total + value;
  }, 0);
  
  const average = sum / subQuestionAnswers.length;
  console.log(`📊 Average Score for Main Question ${parentQuestionId}: Average = ${average}`);
  
  const threshold = config.threshold || 0.5;
  const aboveThresholdScore = config.above_threshold_score || 1;
  const belowThresholdScore = config.below_threshold_score || 0;
  
  const score = average >= threshold ? aboveThresholdScore : belowThresholdScore;
  console.log(`   → Score: ${score} (${average >= threshold ? 'above' : 'below'} threshold ${threshold})`);
  
  return score;
}

// Weighted Sum Scoring
function calculateWeightedSumScore(parentQuestionId, subQuestionAnswers, config) {
  const weights = config.weights || {};
  
  const weightedSum = subQuestionAnswers.reduce((total, answer) => {
    const value = parseFloat(answer.option_value) || 0;
    const weight = weights[answer.question_id] || 1;
    return total + (value * weight);
  }, 0);
  
  console.log(`📊 Weighted Sum for Main Question ${parentQuestionId}: Weighted Sum = ${weightedSum}`);
  
  const threshold = config.threshold || 1;
  const aboveThresholdScore = config.above_threshold_score || 1;
  const belowThresholdScore = config.below_threshold_score || 0;
  
  const score = weightedSum >= threshold ? aboveThresholdScore : belowThresholdScore;
  console.log(`   → Score: ${score} (${weightedSum >= threshold ? 'above' : 'below'} threshold ${threshold})`);
  
  return score;
}

// Get explanation of scoring logic for debugging
function getScoringLogicExplanation(scoringMethod, questionId, answers, finalScore, config) {
  let logic = "";
  
  switch(scoringMethod) {
    case 'nested_conditional':
      const level1 = answers.filter(a => !a.nested_level);
      const level3 = answers.filter(a => a.nested_level === 3);
      const hasScore1 = level1.some(a => parseInt(a.option_value) === 1);
      const hasFrequencyYes = level3.some(a => parseInt(a.option_value) === 1);
      
      if (!hasScore1 || level3.length === 0) {
        logic = `No score=1 answers or no frequency question → Score = 0`;
      } else if (hasFrequencyYes) {
        logic = `Score=1 answer AND frequency Yes (more than twice/week) → Score = 1`;
      } else {
        logic = `Score=1 answer BUT frequency No (≤ twice/week) → Score = 0`;
      }
      return { logic, has_score_1: hasScore1, has_frequency_yes: hasFrequencyYes, final_score: finalScore };
    
    case 'or_logic':
    case 'any_yes':
      const yesAnswers = answers.filter(answer => parseInt(answer.option_value) === 1);
      const noAnswers = answers.filter(answer => parseInt(answer.option_value) === 0);
      
      if (yesAnswers.length > 0) {
        logic = `Yes to at least one sub-question → Score = 1`;
      } else {
        logic = `No to all sub-questions → Score = 0`;
      }
      return {
        logic: logic,
        yes_count: yesAnswers.length,
        no_count: noAnswers.length,
        final_score: finalScore
      };
    
    case 'decision_tree':
      const zeroValueAnswers = answers.filter(answer => answer.option_value === 0);
      const oneValueAnswers = answers.filter(answer => answer.option_value === 1);
      
      if (zeroValueAnswers.length > 0 && oneValueAnswers.length === 0) {
        logic = "Yes only to 0 example(s) → Score = 0";
      } else if (oneValueAnswers.length > 0 && zeroValueAnswers.length === 0) {
        logic = "Yes only to 1 example(s) → Score = 1";
      } else if (zeroValueAnswers.length > 0 && oneValueAnswers.length > 0) {
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
    
    case 'simple_sum':
      const sum = answers.reduce((total, answer) => parseInt(answer.option_value) || 0, 0);
      const threshold = config?.threshold || 1;
      logic = `Sum of values = ${sum} (${sum >= threshold ? '≥' : '<'} threshold ${threshold}) → Score = ${finalScore}`;
      return { logic, sum, threshold, final_score: finalScore };
    
    case 'average_score':
      const avg = answers.length > 0 ? answers.reduce((total, answer) => parseFloat(answer.option_value) || 0, 0) / answers.length : 0;
      const avgThreshold = config?.threshold || 0.5;
      logic = `Average = ${avg.toFixed(2)} (${avg >= avgThreshold ? '≥' : '<'} threshold ${avgThreshold}) → Score = ${finalScore}`;
      return { logic, average: avg, threshold: avgThreshold, final_score: finalScore };
    
    case 'weighted_sum':
      const weightedSum = answers.reduce((total, answer) => {
        const value = parseFloat(answer.option_value) || 0;
        const weight = config?.weights?.[answer.question_id] || 1;
        return total + (value * weight);
      }, 0);
      const wThreshold = config?.threshold || 1;
      logic = `Weighted sum = ${weightedSum.toFixed(2)} (${weightedSum >= wThreshold ? '≥' : '<'} threshold ${wThreshold}) → Score = ${finalScore}`;
      return { logic, weighted_sum: weightedSum, threshold: wThreshold, final_score: finalScore };
    
    default:
      return { logic: `Unknown method: ${scoringMethod}`, final_score: finalScore };
  }
}
