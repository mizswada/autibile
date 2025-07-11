<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const patientId = route.params.id;

const isLoading = ref(true);
const isGeneratingPdf = ref(false);
const message = ref('');
const messageType = ref('success');
const patientDetails = ref(null);
const selectedPatient = ref(null);
const reportRef = ref(null);

// Show message helper
function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 3000);
}

// Format date helper
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
}

// Calculate age from date of birth
function calculateAge(dob) {
  if (!dob) return 'N/A';
  
  const birthDate = new Date(dob);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age + ' years';
}

// Load patient details
async function loadPatientDetails() {
  isLoading.value = true;
  try {
    // Fetch child information with detailed data
    const childResponse = await fetch(`/api/parents/manageChild/fetchEditChild?childID=${patientId}`);
    const childResult = await childResponse.json();
    
    if (childResult.statusCode !== 200 || !childResult.data) {
      showMessage('Patient not found', 'error');
      router.push('/diaryReport');
      return;
    }
    
    selectedPatient.value = childResult.data;
    console.log('Patient data:', selectedPatient.value);
    
    // Get parent ID from the parent-child relationship
    const parentChildResponse = await fetch(`/api/parents/manageChild/getParentByChild?childID=${patientId}`);
    const parentChildResult = await parentChildResponse.json();
    console.log('Parent-Child relationship data:', parentChildResult);
    
    let parentId = null;
    if (parentChildResult.statusCode === 200 && parentChildResult.data) {
      parentId = parentChildResult.data.parent_id;
    }
    
    // Fetch parent information with detailed data
    const parentResponse = await fetch(`/api/parents/fetchEdit?parentID=${parentId}`);
    const parentResult = await parentResponse.json();
    console.log('Parent data:', parentResult.data);
    
    // Fetch relationship name if relationship ID exists
    let relationshipName = 'N/A';
    if (parentResult.statusCode === 200 && parentResult.data && parentResult.data.relationship) {
      const lookupResponse = await fetch(`/api/lookup/get?lookupID=${parentResult.data.relationship}`);
      const lookupResult = await lookupResponse.json();
      if (lookupResult.statusCode === 200 && lookupResult.data) {
        relationshipName = lookupResult.data.title || 'N/A';
        // Add the relationship name to the parent data
        parentResult.data.relationshipName = relationshipName;
      }
    }
    
    // Fetch questionnaire results (scores, indicators, recommendations)
    // Ensure we're passing the correct patientID parameter
    const scoresResponse = await fetch(`/api/questionnaire/responses/list?patientId=${patientId}`);
    const scoresResult = await scoresResponse.json();
    console.log('Scores data:', scoresResult.data);
    
    // Get parent full name from the correct field
    let parentFullName = '';
    if (parentResult.statusCode === 200 && parentResult.data) {
      parentFullName = parentResult.data.fullName;
    }
    
    patientDetails.value = {
      parent: parentResult.statusCode === 200 ? parentResult.data : null,
      child: childResult.data,
      parentFullName: parentFullName,
      scores: scoresResult.statusCode === 200 ? scoresResult.data : [],
      indicators: [],
      recommendations: []
    };
    
    // Process scores to extract indicators and recommendations
    if (scoresResult.statusCode === 200 && scoresResult.data && scoresResult.data.length > 0) {
      patientDetails.value.indicators = extractIndicators(scoresResult.data);
      patientDetails.value.recommendations = generateRecommendations(scoresResult.data);
    } else {
      console.log('No questionnaire scores found for patient ID:', patientId);
    }
  } catch (error) {
    console.error('Error fetching patient details:', error);
    showMessage('Error loading patient details', 'error');
  } finally {
    isLoading.value = false;
  }
}

// Process questionnaire responses to extract indicators and recommendations
function extractIndicators(scores) {
  return scores?.map(score => {
    const scoreValue = parseInt(score.score) || 0;
    return {
      category: score.questionnaire_title || score.title || 'Assessment',
      value: scoreValue,
      level: getLevel(scoreValue),
      description: getDescription(scoreValue, score.questionnaire_title)
    };
  }) || [];
}

function generateRecommendations(scores) {
  return scores?.map(score => {
    const scoreValue = parseInt(score.score) || 0;
    const category = score.questionnaire_title || score.title || 'Assessment';
    
    return {
      category: category,
      text: getRecommendationText(scoreValue, category)
    };
  }) || [];
}

function getLevel(score) {
  if (score > 70) return 'High';
  if (score > 40) return 'Medium';
  return 'Low';
}

function getDescription(score, category = '') {
  if (score > 70) return `Significant concern in ${category} assessment`;
  if (score > 40) return `Moderate concern in ${category} assessment`;
  return `Minimal concern in ${category} assessment`;
}

function getRecommendationText(score, category = '') {
  if (score > 70) {
    return `Based on the high score (${score}) in ${category}, we recommend immediate intervention and regular therapy sessions.`;
  } else if (score > 40) {
    return `Based on the moderate score (${score}) in ${category}, we recommend scheduled therapy sessions and regular monitoring.`;
  } else {
    return `Based on the low score (${score}) in ${category}, we recommend periodic check-ins and monitoring for any changes.`;
  }
}

// Generate report for the selected patient
async function generateReport() {
  if (!patientId || !selectedPatient.value) {
    showMessage('Cannot identify patient', 'error');
    return;
  }
  
  isGeneratingPdf.value = true;
  try {
    // Import jsPDF dynamically
    const { default: jsPDF } = await import('jspdf');
    
    showMessage('Generating PDF, please wait...', 'success');
    
    // Create a PDF with A4 dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Add header with title
    pdf.setFontSize(18);
    pdf.text(`Patient Report: ${selectedPatient.value.fullname}`, 14, 20);
    pdf.setFontSize(12);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    let yPosition = 40;
    const lineHeight = 7;
    const sectionSpacing = 15;
    const subSectionSpacing = 10;
    
    // Helper function to add a section title
    function addSectionTitle(title, y) {
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text(title, 14, y);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(11);
      return y + lineHeight;
    }
    
    // Helper function to add a field with label and value
    function addField(label, value, y) {
      pdf.text(`${label}: ${value || 'N/A'}`, 14, y);
      return y + lineHeight;
    }
    
    // Patient Information Section
    yPosition = addSectionTitle('Patient Information', yPosition);
    yPosition += 2;
    yPosition = addField('Full Name', selectedPatient.value.fullname || 'N/A', yPosition);
    yPosition = addField('Nickname', selectedPatient.value.nickname || 'N/A', yPosition);
    yPosition = addField('IC Number', selectedPatient.value.patient_ic || 'N/A', yPosition);
    yPosition = addField('Gender', selectedPatient.value.gender || 'N/A', yPosition);
    yPosition = addField('Date of Birth', formatDate(selectedPatient.value.dob), yPosition);
    yPosition = addField('Age', calculateAge(selectedPatient.value.dob), yPosition);
    yPosition = addField('Autism Diagnosis', selectedPatient.value.autism_diagnose || 'Not diagnosed', yPosition);
    yPosition = addField('Diagnosed Date', formatDate(selectedPatient.value.diagnosed_on), yPosition);
    yPosition = addField('Status', selectedPatient.value.status || 'N/A', yPosition);
    
    // Add spacing between sections
    yPosition += sectionSpacing;
    
    // Parent Information Section
    yPosition = addSectionTitle('Parent Information', yPosition);
    yPosition += 2;
    yPosition = addField('Full Name', patientDetails.value.parent?.fullName || 'N/A', yPosition);
    if (patientDetails.value.parent) {
      yPosition = addField('Email', patientDetails.value.parent.email || 'N/A', yPosition);
      yPosition = addField('Phone', patientDetails.value.parent.phone || 'N/A', yPosition);
      yPosition = addField('Relationship', patientDetails.value.parent.relationshipName || 'N/A', yPosition);
      yPosition = addField('Address', patientDetails.value.parent.addressLine1 || 'N/A', yPosition);
      yPosition = addField('City', patientDetails.value.parent.city || 'N/A', yPosition);
      yPosition = addField('Postal Code', patientDetails.value.parent.postcode || 'N/A', yPosition);
    }
    
    // Check if we need a new page for scores
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    } else {
      yPosition += sectionSpacing;
    }
    
    // Assessment Scores Section
    yPosition = addSectionTitle('Assessment Scores', yPosition);
    yPosition += 2;
    
    if (patientDetails.value.scores && patientDetails.value.scores.length > 0) {
      // Table headers
      pdf.setFont(undefined, 'bold');
      pdf.text('Questionnaire', 14, yPosition);
      pdf.text('Score', 100, yPosition);
      pdf.text('Date', 130, yPosition);
      pdf.text('Status', 170, yPosition);
      pdf.setFont(undefined, 'normal');
      yPosition += lineHeight;
      
      // Table rows
      for (const score of patientDetails.value.scores) {
        // Check if we need a new page
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
          
          // Repeat headers on new page
          pdf.setFont(undefined, 'bold');
          pdf.text('Questionnaire', 14, yPosition);
          pdf.text('Score', 100, yPosition);
          pdf.text('Date', 130, yPosition);
          pdf.text('Status', 170, yPosition);
          pdf.setFont(undefined, 'normal');
          yPosition += lineHeight;
        }
        
        // Truncate long titles
        const title = (score.questionnaire_title || 'Assessment').substring(0, 30);
        pdf.text(title, 14, yPosition);
        pdf.text(score.total_score?.toString() || 'N/A', 100, yPosition);
        pdf.text(formatDate(score.created_at), 130, yPosition);
        pdf.text('Completed', 170, yPosition);
        yPosition += lineHeight;
      }
    } else {
      pdf.text('No assessment scores available', 14, yPosition);
      yPosition += lineHeight;
    }
    
    // Check if we need a new page for indicators
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    } else {
      yPosition += sectionSpacing;
    }
    
    // Indicators Section
    yPosition = addSectionTitle('Indicators', yPosition);
    yPosition += 2;
    
    if (patientDetails.value.indicators && patientDetails.value.indicators.length > 0) {
      for (const indicator of patientDetails.value.indicators) {
        // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFont(undefined, 'bold');
        pdf.text(`${indicator.category} - ${indicator.level}`, 14, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += lineHeight;
        
        // Handle long descriptions with text wrapping
        const splitText = pdf.splitTextToSize(indicator.description, pageWidth - 28);
        pdf.text(splitText, 14, yPosition);
        yPosition += (splitText.length * lineHeight) + subSectionSpacing;
      }
    } else {
      pdf.text('No indicators available', 14, yPosition);
      yPosition += lineHeight;
    }
    
    // Check if we need a new page for recommendations
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    } else {
      yPosition += sectionSpacing;
    }
    
    // Recommendations Section
    yPosition = addSectionTitle('Recommendations', yPosition);
    yPosition += 2;
    
    if (patientDetails.value.recommendations && patientDetails.value.recommendations.length > 0) {
      for (const recommendation of patientDetails.value.recommendations) {
        // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        
        pdf.setFont(undefined, 'bold');
        pdf.text(recommendation.category, 14, yPosition);
        pdf.setFont(undefined, 'normal');
        yPosition += lineHeight;
        
        // Handle long text with text wrapping
        const splitText = pdf.splitTextToSize(recommendation.text, pageWidth - 28);
        pdf.text(splitText, 14, yPosition);
        yPosition += (splitText.length * lineHeight) + subSectionSpacing;
      }
    } else {
      pdf.text('No recommendations available', 14, yPosition);
      yPosition += lineHeight;
    }
    
    // Add footer with page numbers
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Save the PDF with a formatted filename
    const filename = `${selectedPatient.value.fullname.replace(/\s+/g, '_')}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
    
    showMessage('Report generated and downloaded successfully', 'success');
  } catch (error) {
    console.error('Error generating report:', error);
    showMessage('Error generating PDF report: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    isGeneratingPdf.value = false;
  }
}

// Load data on component mount
onMounted(loadPatientDetails);
</script>

<template>
  <div>
    <div class="flex items-center mb-6">
      <button @click="router.push('/diaryReport')" class="mr-2 p-2 rounded hover:bg-gray-100">
        <Icon name="material-symbols:arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Patient Diary Report</h1>
    </div>

    <!-- Message display -->
    <div v-if="message" class="mb-4 p-3 rounded text-white"
      :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <!-- PDF Generation Loading Overlay -->
    <div v-if="isGeneratingPdf" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mx-auto mb-4"></div>
        <h3 class="text-lg font-medium mb-2">Generating PDF</h3>
        <p class="text-gray-600">Please wait while we create your report...</p>
      </div>
    </div>

    <div v-else-if="patientDetails && selectedPatient" class="space-y-6">
      <!-- Action buttons -->
      <div class="flex justify-end">
        <rs-button 
          @click="generateReport()" 
          color="success"
          :loading="isGeneratingPdf"
          :disabled="isGeneratingPdf"
        >
          <Icon name="material-symbols:description" class="mr-1" />
          {{ isGeneratingPdf ? 'Generating...' : 'Generate Report' }}
        </rs-button>
      </div>
      
      <!-- Report content container with ref for PDF generation -->
      <div ref="reportRef" id="report-content" class="space-y-6">
        <!-- Patient Info Section -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-blue-50 px-4 py-2 border-b">
            <h3 class="text-lg font-medium text-blue-800">Patient Information</h3>
          </div>
          <div class="bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Full Name</p>
              <p class="text-base">{{ selectedPatient.fullname || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Nickname</p>
              <p class="text-base">{{ selectedPatient.nickname || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">IC Number</p>
              <p class="text-base">{{ selectedPatient.patient_ic || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Gender</p>
              <p class="text-base">{{ selectedPatient.gender || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Date of Birth</p>
              <p class="text-base">{{ formatDate(selectedPatient.dob) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Age</p>
              <p class="text-base">{{ calculateAge(selectedPatient.dob) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Autism Diagnosis</p>
              <p class="text-base">{{ selectedPatient.autism_diagnose || 'Not diagnosed' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Diagnosed Date</p>
              <p class="text-base">{{ formatDate(selectedPatient.diagnosed_on) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Status</p>
              <p class="text-base">{{ selectedPatient.status || 'N/A' }}</p>
            </div>
          </div>
        </div>
        
        <!-- Parent Info Section -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-green-50 px-4 py-2 border-b">
            <h3 class="text-lg font-medium text-green-800">Parent Information</h3>
          </div>
          <div class="bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-500">Full Name</p>
              <p class="text-base">{{ patientDetails.parent?.fullName || 'N/A' }}</p>
            </div>
            <div v-if="patientDetails.parent">
              <p class="text-sm font-medium text-gray-500">Email</p>
              <p class="text-base">{{ patientDetails.parent.email || 'N/A' }}</p>
            </div>
            <div v-if="patientDetails.parent">
              <p class="text-sm font-medium text-gray-500">Phone</p>
              <p class="text-base">{{ patientDetails.parent.phone || 'N/A' }}</p>
            </div>
            <div v-if="patientDetails.parent">
              <p class="text-sm font-medium text-gray-500">Relationship</p>
              <p class="text-base">{{ patientDetails.parent.relationshipName || 'N/A' }}</p>
            </div>
            <div v-if="patientDetails.parent">
              <p class="text-sm font-medium text-gray-500">Address</p>
              <p class="text-base">
                {{ patientDetails.parent.addressLine1 || 'N/A' }}
                <span v-if="patientDetails.parent.addressLine2"><br>{{ patientDetails.parent.addressLine2 }}</span>
                <span v-if="patientDetails.parent.addressLine3"><br>{{ patientDetails.parent.addressLine3 }}</span>
              </p>
            </div>
            <div v-if="patientDetails.parent">
              <p class="text-sm font-medium text-gray-500">City</p>
              <p class="text-base">{{ patientDetails.parent.city || 'N/A' }}</p>
            </div>
            <div v-if="patientDetails.parent">
              <p class="text-sm font-medium text-gray-500">Postal Code</p>
              <p class="text-base">{{ patientDetails.parent.postcode || 'N/A' }}</p>
            </div>
          </div>
        </div>
        
        <!-- Scores Section -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-purple-50 px-4 py-2 border-b">
            <h3 class="text-lg font-medium text-purple-800">Assessment Scores</h3>
          </div>
          <div class="p-4">
            <div v-if="patientDetails.scores && patientDetails.scores.length > 0">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Questionnaire Title
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Completion Date
                      </th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="(score, index) in patientDetails.scores" :key="index">
                      <td class="px-6 py-4 text-sm text-gray-900">{{ score.questionnaire_title || 'Assessment' }}</td>
                      <td class="px-6 py-4 text-sm text-gray-900">
                        <span class="font-medium" :class="{
                          'text-red-600': parseInt(score.total_score) > 70,
                          'text-yellow-600': parseInt(score.total_score) > 40 && parseInt(score.total_score) <= 70,
                          'text-green-600': parseInt(score.total_score) <= 40
                        }">{{ score.total_score || 'N/A' }}</span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900">{{ formatDate(score.created_at) }}</td>
                      <td class="px-6 py-4 text-sm">
                        <span class="px-2 py-1 text-xs rounded-full"
                              :class="{
                                'bg-green-100 text-green-800': true,
                                'bg-yellow-100 text-yellow-800': false,
                                'bg-gray-100 text-gray-800': false
                              }">
                          Completed
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <!-- Answers details section -->
              <div v-if="patientDetails.scores.length > 0" class="mt-6">
                <h4 class="text-md font-medium mb-3">Detailed Answers</h4>
                
                <div v-for="(score, scoreIndex) in patientDetails.scores" :key="'score-'+scoreIndex" class="mb-6 border rounded-lg overflow-hidden">
                  <div class="bg-white px-4 py-2 border-b">
                    <h5 class="font-medium">{{ score.questionnaire_title || 'Assessment' }}</h5>
                  </div>
                  
                  <div class="p-4">
                    <div v-if="score.answers && score.answers.length > 0">
                      <div v-for="(answer, answerIndex) in score.answers" :key="'answer-'+answerIndex" class="mb-4 border-b pb-4 last:border-b-0 last:pb-0">
                        <p class="font-medium mb-1">
                          Q{{ answerIndex + 1 }}: {{ answer.question_text || 'Question' }}
                          <span v-if="answer.question_text_bm" class="text-gray-500 italic">
                            ({{ answer.question_text_bm }})
                          </span>
                        </p>
                        
                        <div class="ml-4">
                          <p v-if="answer.text_answer" class="text-sm">
                            <span class="font-medium">Answer:</span> {{ answer.text_answer }}
                          </p>
                          <p v-else-if="answer.option_title" class="text-sm">
                            <span class="font-medium">Selected:</span> {{ answer.option_title }}
                          </p>
                          <p v-else class="text-sm text-gray-500 italic">No answer provided</p>
                          
                          <p v-if="answer.score" class="text-sm mt-1">
                            <span class="font-medium">Score:</span> {{ answer.score }}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p v-else class="text-gray-500 italic">No detailed answers available</p>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4 text-gray-500">
              No assessment scores available for this patient
            </div>
          </div>
        </div>
        
        <!-- Indicators Section -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-amber-50 px-4 py-2 border-b">
            <h3 class="text-lg font-medium text-amber-800">Indicators</h3>
          </div>
          <div class="p-4">
            <div v-if="patientDetails.indicators && patientDetails.indicators.length > 0">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="(indicator, index) in patientDetails.indicators" :key="index" 
                     class="border rounded p-3"
                     :class="{
                       'bg-red-50': indicator.level === 'High',
                       'bg-yellow-50': indicator.level === 'Medium',
                       'bg-green-50': indicator.level === 'Low'
                     }">
                  <div class="font-medium">{{ indicator.category }}</div>
                  <div class="flex items-center mt-1">
                    <span class="px-2 py-1 text-xs rounded-full mr-2"
                          :class="{
                            'bg-red-100 text-red-800': indicator.level === 'High',
                            'bg-yellow-100 text-yellow-800': indicator.level === 'Medium',
                            'bg-green-100 text-green-800': indicator.level === 'Low'
                          }">
                      {{ indicator.level }}
                    </span>
                    <span class="text-sm">{{ indicator.description }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4 text-gray-500">
              No indicators available
            </div>
          </div>
        </div>
        
        <!-- Recommendations Section -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-teal-50 px-4 py-2 border-b">
            <h3 class="text-lg font-medium text-teal-800">Recommendations</h3>
          </div>
          <div class="p-4">
            <div v-if="patientDetails.recommendations && patientDetails.recommendations.length > 0">
              <ul class="space-y-2">
                <li v-for="(recommendation, index) in patientDetails.recommendations" :key="index" 
                    class="border-l-4 border-teal-500 pl-3 py-1">
                  <div class="font-medium text-sm">{{ recommendation.category }}</div>
                  <div class="text-sm mt-1">{{ recommendation.text }}</div>
                </li>
              </ul>
            </div>
            <div v-else class="text-center py-4 text-gray-500">
              No recommendations available
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="!isLoading" class="text-center py-8">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:error-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Patient Not Found</h3>
        <p class="text-gray-500 mb-6">The patient you are looking for could not be found.</p>
        <rs-button @click="router.push('/diaryReport')">
          Back to Diary Reports
        </rs-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any specific styles here */
</style> 