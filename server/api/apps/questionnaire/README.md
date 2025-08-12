# Mobile Questionnaire API Documentation

This document describes the mobile questionnaire APIs that support conditional sub-questions, similar to the web version.

## Overview

The mobile questionnaire system provides several APIs to handle questionnaires with conditional logic, where sub-questions are shown based on selected options in parent questions.

## API Endpoints

### 1. List Questionnaires
**GET** `/api/apps/questionnaire/listQuestionnaire`

Lists all questionnaires with basic information.

**Query Parameters:**
- `questionnaireID` (optional): Filter by specific questionnaire ID

**Response:**
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": [
    {
      "questionnaire_id": 1,
      "title": "Sample Questionnaire",
      "description": "Description",
      "header": "Header text",
      "status": "Active",
      "questionnaires_questions": [...]
    }
  ]
}
```

### 2. List Questions
**GET** `/api/apps/questionnaire/questions/listQuestions`

Lists questions for a questionnaire with optional sub-questions and options.

**Query Parameters:**
- `questionnaireID`: Required - The questionnaire ID
- `parentID` (optional): Filter by parent question ID (use 'null' for top-level questions)
- `selectedOptionValue` (optional): Show conditional sub-questions based on selected option
- `includeOptions` (optional): Set to 'true' to include options for questions
- `status` (optional): Filter by question status

**Response:**
```json
{
  "statusCode": 200,
  "message": "Questions retrieved successfully",
  "data": [
    {
      "question_id": 1,
      "question_text_bi": "Question text",
      "question_text_bm": "Question text in BM",
      "is_required": true,
      "status": "Active",
      "options": [...],
      "has_sub_questions": true,
      "sub_questions_count": 2,
      "conditional_sub_questions": [...]
    }
  ]
}
```

### 3. Get Conditional Sub-Questions
**GET** `/api/apps/questionnaire/questions/getConditionalSubQuestions`

Retrieves conditional sub-questions based on selected options.

**Query Parameters:**
- `questionnaireID`: Required - The questionnaire ID
- `parentQuestionID`: Required - The parent question ID
- `selectedOptionValue` (optional): The selected option value for conditional logic
- `showAllSubQuestions` (optional): Set to 'true' to show all sub-questions
- `includeOptions` (optional): Set to 'true' to include options for sub-questions

**Response:**
```json
{
  "statusCode": 200,
  "message": "Conditional sub-questions retrieved successfully",
  "data": {
    "parent_question_id": 1,
    "questionnaire_id": 1,
    "selected_option": {
      "option_id": 1,
      "option_value": 1,
      "option_title": "Yes"
    },
    "sub_questions": [...],
    "total_count": 2,
    "conditional_logic_applied": true,
    "conditional_sub_questions_ids": [3, 4]
  }
}
```

### 4. Get Questionnaire Structure
**GET** `/api/apps/questionnaire/structure`

Retrieves the complete questionnaire structure with conditional logic information.

**Query Parameters:**
- `questionnaireID`: Required - The questionnaire ID
- `includeOptions` (optional): Set to 'true' to include options for all questions

**Response:**
```json
{
  "statusCode": 200,
  "message": "Questionnaire structure retrieved successfully",
  "data": {
    "questionnaire_id": 1,
    "title": "Sample Questionnaire",
    "questions": [
      {
        "question_id": 1,
        "question_text_bi": "Question text",
        "has_conditional_logic": true,
        "conditional_options": [
          {
            "option_id": 1,
            "option_value": 1,
            "option_title": "Yes",
            "conditional_sub_questions_ids": [3, 4]
          }
        ],
        "sub_questions": [...],
        "options": [...]
      }
    ]
  }
}
```

### 5. Get Questionnaire Flow
**GET** `/api/apps/questionnaire/flow`

Retrieves questionnaire flow with current question and conditional sub-questions based on answers.

**Query Parameters:**
- `questionnaireID`: Required - The questionnaire ID
- `currentQuestionID` (optional): The current question ID for progress tracking
- `selectedAnswers` (optional): JSON string of selected answers for conditional logic
- `includeOptions` (optional): Set to 'true' to include options for questions

**Response:**
```json
{
  "statusCode": 200,
  "message": "Questionnaire flow retrieved successfully",
  "data": {
    "questionnaire": {...},
    "current_question": {...},
    "next_questions": [...],
    "conditional_sub_questions": [
      {
        "parent_question_id": 1,
        "parent_question_text": "Parent question text",
        "selected_option": {
          "option_id": 1,
          "option_value": 1,
          "option_title": "Yes"
        },
        "sub_questions": [...]
      }
    ],
    "progress": {
      "current": 2,
      "total": 5,
      "percentage": 40
    }
  }
}
```

### 6. List Options
**GET** `/api/apps/questionnaire/options/listOptions`

Lists options for a specific question.

**Query Parameters:**
- `questionID`: Required - The question ID

**Response:**
```json
{
  "statusCode": 200,
  "message": "Options retrieved successfully",
  "data": [
    {
      "option_id": 1,
      "option_title": "Yes",
      "option_value": 1,
      "conditional_sub_questions_ids": "[3,4]"
    }
  ]
}
```

### 7. Batch Options
**GET** `/api/apps/questionnaire/options/batch`

Efficiently retrieves options for multiple questions at once.

**Query Parameters:**
- `questionIDs`: Required - Comma-separated list of question IDs

**Response:**
```json
{
  "statusCode": 200,
  "message": "Batch options retrieved successfully",
  "data": {
    "1": [
      {
        "option_id": 1,
        "option_title": "Yes",
        "option_value": 1
      }
    ],
    "2": [
      {
        "option_id": 3,
        "option_title": "No",
        "option_value": 0
      }
    ]
  }
}
```

## Mobile Implementation Flow

### Step 1: Load Questionnaire Structure
```javascript
// Get complete questionnaire structure
const response = await fetch(`/api/apps/questionnaire/structure?questionnaireID=1&includeOptions=true`);
const questionnaire = await response.json();
```

### Step 2: Handle Conditional Logic
```javascript
// When user selects an option
function onOptionSelected(questionId, optionId) {
  // Check if this option has conditional sub-questions
  const question = questionnaire.data.questions.find(q => q.question_id === questionId);
  const option = question.options.find(o => o.option_id === optionId);
  
  if (option.conditional_sub_questions_ids) {
    // Load conditional sub-questions
    loadConditionalSubQuestions(questionId, option.option_value);
  }
}
```

### Step 3: Load Conditional Sub-Questions
```javascript
async function loadConditionalSubQuestions(parentQuestionId, selectedOptionValue) {
  const response = await fetch(
    `/api/apps/questionnaire/questions/getConditionalSubQuestions?` +
    `questionnaireID=1&parentQuestionID=${parentQuestionId}&` +
    `selectedOptionValue=${selectedOptionValue}&includeOptions=true`
  );
  const result = await response.json();
  
  if (result.data.sub_questions.length > 0) {
    // Display conditional sub-questions
    displayConditionalSubQuestions(result.data.sub_questions);
  }
}
```

### Step 4: Progressive Loading (Optional)
```javascript
// For better mobile UX, load questions progressively
async function loadQuestionFlow(currentQuestionId, selectedAnswers) {
  const response = await fetch(
    `/api/apps/questionnaire/flow?` +
    `questionnaireID=1&currentQuestionID=${currentQuestionId}&` +
    `selectedAnswers=${JSON.stringify(selectedAnswers)}&includeOptions=true`
  );
  const result = await response.json();
  
  // Display current question and conditional sub-questions
  displayCurrentQuestion(result.data.current_question);
  displayConditionalSubQuestions(result.data.conditional_sub_questions);
}
```

## Conditional Logic Structure

The conditional logic is stored in the `conditional_sub_questions_ids` field of options:

```json
{
  "option_id": 1,
  "option_title": "Yes",
  "option_value": 1,
  "conditional_sub_questions_ids": "[3,4,5]"
}
```

This means when option "Yes" is selected, questions with IDs 3, 4, and 5 will be shown as sub-questions.

## Best Practices for Mobile

1. **Progressive Loading**: Use the flow API to load questions one by one for better mobile UX
2. **Batch Operations**: Use the batch options API to reduce API calls
3. **Conditional Display**: Always check for conditional logic before displaying sub-questions
4. **Error Handling**: Handle cases where conditional logic might be malformed
5. **Caching**: Cache questionnaire structure and options to reduce API calls

## Error Handling

All APIs return consistent error responses:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Error details"
}
```

## Performance Considerations

- Use `includeOptions=false` when you don't need options to reduce data transfer
- Use batch APIs to reduce the number of HTTP requests
- Consider implementing client-side caching for static questionnaire data
- Use progressive loading for long questionnaires
