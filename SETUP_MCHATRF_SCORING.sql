-- Setup MCHATR-F Scoring Configurations
-- Run this after the migration to set up scoring methods for each main question

-- ==============================================
-- Question 1: Decision Tree Method
-- ==============================================
UPDATE questionnaires_questions 
SET 
  scoring_method = 'decision_tree',
  scoring_config = '{
    "method": "decision_tree",
    "description": "Decision tree logic based on 0-value and 1-value sub-question answers",
    "rules": {
      "all_zero": "Score = 0",
      "all_one": "Score = 1",
      "mixed_compare_counts": "Score = 1 if more 1-value answers, else 0"
    }
  }'
WHERE mchatr_id = 1 AND questionnaire_id = 2;

-- ==============================================
-- Question 2: OR Logic (Any Yes)
-- ==============================================
-- Score = 1 if ANY sub-question is Yes (value=1)
-- Score = 0 if ALL sub-questions are No (value=0)
UPDATE questionnaires_questions 
SET 
  scoring_method = 'or_logic',
  scoring_config = '{
    "method": "or_logic",
    "description": "Score = 1 if any sub-question is Yes, Score = 0 if all are No"
  }'
WHERE mchatr_id = 2 AND questionnaire_id = 2;

-- ==============================================
-- Question 5: Nested Conditional Logic
-- ==============================================
-- Score = 1 ONLY if:
--   1. Any sub-question option with score=1 is selected
--   2. AND the frequency question (nested nested) is Yes (more than twice a week)
-- Score = 0 otherwise
UPDATE questionnaires_questions 
SET 
  scoring_method = 'nested_conditional',
  scoring_config = '{
    "method": "nested_conditional",
    "description": "Requires both score=1 answer AND frequency Yes (> twice/week) for Score = 1"
  }'
WHERE mchatr_id = 5 AND questionnaire_id = 2;

-- ==============================================
-- Question 3-4, 6-7: Set as Decision Tree by default
-- ==============================================
-- You can later change these to different methods as needed
UPDATE questionnaires_questions 
SET 
  scoring_method = 'decision_tree',
  scoring_config = '{
    "method": "decision_tree",
    "description": "Decision tree logic based on 0-value and 1-value sub-question answers"
  }'
WHERE mchatr_id IN (3, 4, 6, 7) AND questionnaire_id = 2;

-- ==============================================
-- Example: Alternative Scoring Methods
-- ==============================================

-- Simple Sum Example (if you want to use this for any question):
/*
UPDATE questionnaires_questions 
SET 
  scoring_method = 'simple_sum',
  scoring_config = '{
    "method": "simple_sum",
    "description": "Sum all option values and compare to threshold",
    "threshold": 1,
    "above_threshold_score": 1,
    "below_threshold_score": 0
  }'
WHERE mchatr_id = 2 AND questionnaire_id = 2;
*/

-- Average Score Example:
/*
UPDATE questionnaires_questions 
SET 
  scoring_method = 'average_score',
  scoring_config = '{
    "method": "average_score",
    "description": "Calculate average of sub-question values",
    "threshold": 0.5,
    "above_threshold_score": 1,
    "below_threshold_score": 0
  }'
WHERE mchatr_id = 3 AND questionnaire_id = 2;
*/

-- Weighted Sum Example:
/*
UPDATE questionnaires_questions 
SET 
  scoring_method = 'weighted_sum',
  scoring_config = '{
    "method": "weighted_sum",
    "description": "Weighted sum of sub-question values",
    "weights": {
      "21": 1.0,
      "22": 1.5,
      "23": 0.5
    },
    "threshold": 2,
    "above_threshold_score": 1,
    "below_threshold_score": 0
  }'
WHERE mchatr_id = 4 AND questionnaire_id = 2;
*/

-- ==============================================
-- Verify Configuration
-- ==============================================
SELECT 
  question_id,
  mchatr_id,
  question_text_bi,
  scoring_method,
  scoring_config
FROM questionnaires_questions
WHERE questionnaire_id = 2 
  AND parentID IS NULL
  AND deleted_at IS NULL
ORDER BY mchatr_id;

