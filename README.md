# Mobile Questionnaire API Documentation

This document describes the mobile-optimized questionnaire APIs that provide conditional sub-questions and MCHAT-R status information in a single API call.

## 🚀 **Key Features**

- **Single API Call**: Get complete questionnaire with all conditional logic
- **Automatic Conditional Sub-questions**: No need for separate API calls
- **MCHAT-R Status Integration**: Built-in eligibility checking
- **Mobile Optimized**: Reduced network requests and payload size
- **Complete Data**: Questions, options, and conditional sub-questions with options

## 📱 **API Endpoints**

### 1. **Mobile Questionnaire** - `/api/apps/questionnaire/mobile`

**Purpose**: Get complete questionnaire with conditional logic and MCHAT-R status

**Parameters**:
- `questionnaireID` (required): The questionnaire ID
- `patientID` (optional): Patient ID for MCHAT-R status checking

**Example Request**:
```bash
GET /api/apps/questionnaire/mobile?questionnaireID=1&patientID=48
```

**Response Structure**:
```json
{
  "statusCode": 200,
  "message": "Mobile questionnaire retrieved successfully",
  "data": {
    "questionnaire_id": 1,
    "title": "MCHAT-R Screening",
    "patient_info": {
      "patient_id": 48,
      "fullname": "John Doe",
      "mchatr_status": "Enable",
      "created_at": "2025-01-01T00:00:00.000Z"
    },
    "mchatr_eligibility": {
      "patient_id": 48,
      "patient_name": "John Doe",
      "mchatr_status": "Enable",
      "has_completed_mchatr": false,
      "is_eligible": true,
      "can_take_mchatr": true,
      "can_retake_mchatr": false,
      "mchatr_score": null,
      "is_eligible_for_questionnaire_2": false
    },
    "questions": [
      {
        "question_id": 60,
        "question_text_bi": "Does your child look at you when you call his/her name?",
        "options": [
          {
            "option_id": 112,
            "option_title": "[radio]LULUS",
            "option_value": 1
          },
          {
            "option_id": 113,
            "option_title": "[radio]GAGAL",
            "option_value": 0
          }
        ],
        "conditional_logic": [
          {
            "option_id": 112,
            "option_value": 1,
            "option_title": "[radio]LULUS",
            "conditional_sub_questions": [
              {
                "question_id": 82,
                "question_text_bi": "Follow-up question for LULUS option",
                "options": [...]
              }
            ]
          }
        ],
        "sub_questions": [...]
      }
    ]
  }
}
```

### 2. **Mobile Eligibility Check** - `/api/apps/questionnaire/mobileEligibility`

**Purpose**: Check patient eligibility for specific questionnaires (especially MCHAT-R)

**Parameters**:
- `patientID` (required): Patient ID
- `questionnaireID` (required): Questionnaire ID

**Example Request**:
```bash
GET /api/apps/questionnaire/mobileEligibility?patientID=48&questionnaireID=1
```

**Response Structure**:
```json
{
  "statusCode": 200,
  "message": "MCHAT-R eligibility check completed",
  "data": {
    "patient_id": 48,
    "patient_name": "John Doe",
    "mchatr_status": "Enable",
    "has_completed_mchatr": false,
    "is_eligible": true,
    "can_take_mchatr": true,
    "can_retake_mchatr": false,
    "mchatr_score": null,
    "is_eligible_for_questionnaire_2": false,
    "questionnaire_id": 1,
    "can_access_questionnaire": true,
    "access_reason": "Patient is eligible for MCHAT-R"
  }
}
```

## 🔍 **MCHAT-R Status Logic**

### **Questionnaire ID 1 (MCHAT-R)**
- **Eligible**: `mchatr_status` is `'Enable'` or `null`
- **Not Eligible**: `mchatr_status` is `'Disable'`
- **Can Retake**: Eligible AND has completed MCHAT-R before
- **Score Range**: 0-20 (0-2: Low Risk, 3-7: Medium Risk, 8+: High Risk)

### **Questionnaire ID 2 (Follow-up)**
- **Eligible**: MCHAT-R score between 3-7 (Medium Risk)
- **Not Eligible**: MCHAT-R score outside 3-7 range or MCHAT-R not completed

## 💡 **Mobile Implementation Flow**

### **Step 1: Check Eligibility**
```javascript
// Check if patient can access the questionnaire
const eligibilityResponse = await fetch(
  `/api/apps/questionnaire/mobileEligibility?patientID=${patientId}&questionnaireID=${questionnaireId}`
);
const eligibility = await eligibilityResponse.json();

if (!eligibility.data.can_access_questionnaire) {
  // Show "Not Eligible" message
  showNotEligibleMessage(eligibility.data.access_reason);
  return;
}
```

### **Step 2: Load Complete Questionnaire**
```javascript
// Load questionnaire with all conditional logic
const response = await fetch(
  `/api/apps/questionnaire/mobile?questionnaireID=${questionnaireId}&patientID=${patientId}`
);
const questionnaire = await response.json();

// Store questionnaire data
setQuestionnaireData(questionnaire.data);
```

### **Step 3: Handle Conditional Logic**
```javascript
// When user selects an option, check for conditional sub-questions
function onOptionSelected(questionId, optionId) {
  const question = questionnaireData.questions.find(q => q.question_id === questionId);
  const conditionalLogic = question.conditional_logic.find(cl => cl.option_id === optionId);
  
  if (conditionalLogic && conditionalLogic.conditional_sub_questions.length > 0) {
    // Display conditional sub-questions immediately
    displayConditionalSubQuestions(conditionalLogic.conditional_sub_questions);
  }
}
```

## 🔧 **Enhanced Existing APIs**

### **List Questions** - `/api/apps/questionnaire/questions/listQuestions`
- **New Parameter**: `includeConditionalSubQuestions=true`
- **New Field**: `conditional_logic_by_option` - includes conditional sub-questions for each option

### **Questionnaire Structure** - `/api/apps/questionnaire/structure`
- **New Parameter**: `includeConditionalSubQuestions=true`
- **Enhanced**: Automatically includes conditional sub-questions in `conditional_options`

## 📊 **Database Schema**

### **Key Tables**
- `questionnaires`: Questionnaire metadata
- `questionnaires_questions`: Questions and sub-questions
- `questionnaires_questions_action`: Question options with conditional logic
- `user_patients`: Patient information including `mchatr_status`
- `questionnaires_responds`: Patient responses and scores

### **Conditional Logic Storage**
```sql
-- In questionnaires_questions_action table
conditional_sub_questions_ids: "[82,83]" -- JSON array of question IDs
```

## 🚨 **Error Handling**

### **Common Error Responses**
```json
{
  "statusCode": 400,
  "message": "Missing required parameters"
}

{
  "statusCode": 404,
  "message": "Questionnaire not found"
}

{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## 🔒 **Security Notes**

- All APIs require valid user session
- Patient data is filtered by user permissions
- MCHAT-R status updates are logged and audited
- Conditional logic is validated server-side

## 📱 **Mobile App Benefits**

1. **Single Network Request**: Load entire questionnaire at once
2. **Offline Capability**: Cache complete questionnaire data
3. **Instant Conditional Logic**: No loading delays for sub-questions
4. **Built-in Eligibility**: No need for separate eligibility checks
5. **Reduced Complexity**: Backend handles all conditional logic
6. **Better UX**: Smooth, responsive questionnaire experience

## 🔄 **Migration from Old APIs**

### **Before (Multiple API Calls)**
```javascript
// Old way - multiple API calls
const questions = await fetch('/api/questions?questionnaireID=1');
const options = await fetch('/api/options?questionIDs=60,61');
const conditionalSubQuestions = await fetch('/api/conditionalSubQuestions?questionID=60&optionValue=1');
```

### **After (Single API Call)**
```javascript
// New way - single API call
const questionnaire = await fetch('/api/apps/questionnaire/mobile?questionnaireID=1&patientID=48');
// Everything included: questions, options, conditional logic, MCHAT-R status
```

This new approach significantly improves mobile app performance and user experience while maintaining all the functionality of the web version.
