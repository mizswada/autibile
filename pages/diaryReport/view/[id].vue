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
const diaryEntries = ref([]);
const expandedDates = ref(new Set());

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
    
    // Fetch diary entries
    await fetchDiaryEntries();
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
    function addField(label, value, y, x = 14) {
      pdf.text(`${label}: ${value || 'N/A'}`, x, y);
      return y + lineHeight;
    }
    
    // Patient and Parent Information Section (Side by Side)
    yPosition = addSectionTitle('Patient & Parent Information', yPosition);
    yPosition += 2;
    
    // Create two columns
    const leftColumnX = 14;
    const rightColumnX = pageWidth / 2 + 7;
    const columnWidth = (pageWidth - 28) / 2;
    
    // Patient Information (Left Column)
    pdf.setFont(undefined, 'bold');
    pdf.text('Patient Information:', leftColumnX, yPosition);
    pdf.setFont(undefined, 'normal');
    yPosition += lineHeight;
    
    yPosition = addField('Full Name', selectedPatient.value.fullname || 'N/A', yPosition, leftColumnX);
    yPosition = addField('Nickname', selectedPatient.value.nickname || 'N/A', yPosition, leftColumnX);
    yPosition = addField('IC Number', selectedPatient.value.patient_ic || 'N/A', yPosition, leftColumnX);
    yPosition = addField('Gender', selectedPatient.value.gender || 'N/A', yPosition, leftColumnX);
    yPosition = addField('Date of Birth', formatDate(selectedPatient.value.dob), yPosition, leftColumnX);
    yPosition = addField('Age', calculateAge(selectedPatient.value.dob), yPosition, leftColumnX);
    yPosition = addField('Autism Diagnosis', selectedPatient.value.autism_diagnose || 'Not diagnosed', yPosition, leftColumnX);
    yPosition = addField('Diagnosed Date', formatDate(selectedPatient.value.diagnosed_on), yPosition, leftColumnX);
    yPosition = addField('Status', selectedPatient.value.status || 'N/A', yPosition, leftColumnX);
    
    // Parent Information (Right Column)
    const parentY = yPosition - (9 * lineHeight); // Reset to same starting position as patient info
    pdf.setFont(undefined, 'bold');
    pdf.text('Parent Information:', rightColumnX, parentY);
    pdf.setFont(undefined, 'normal');
    let parentCurrentY = parentY + lineHeight;
    
    parentCurrentY = addField('Full Name', patientDetails.value.parent?.fullName || 'N/A', parentCurrentY, rightColumnX);
    if (patientDetails.value.parent) {
      parentCurrentY = addField('Email', patientDetails.value.parent.email || 'N/A', parentCurrentY, rightColumnX);
      parentCurrentY = addField('Phone', patientDetails.value.parent.phone || 'N/A', parentCurrentY, rightColumnX);
      parentCurrentY = addField('Relationship', patientDetails.value.parent.relationshipName || 'N/A', parentCurrentY, rightColumnX);
      parentCurrentY = addField('Address', patientDetails.value.parent.addressLine1 || 'N/A', parentCurrentY, rightColumnX);
      parentCurrentY = addField('City', patientDetails.value.parent.city || 'N/A', parentCurrentY, rightColumnX);
      parentCurrentY = addField('Postal Code', patientDetails.value.parent.postcode || 'N/A', parentCurrentY, rightColumnX);
    }
    
    // Use the higher Y position to continue
    yPosition = Math.max(yPosition, parentCurrentY);
    
    // Check if we need a new page for diary entries
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    } else {
      yPosition += sectionSpacing;
    }
    
    // Diary Entries Section
    yPosition = addSectionTitle('Diary Entries', yPosition);
    yPosition += 2;
    
    if (diaryEntries.value && diaryEntries.value.length > 0) {
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = 20;
      }
      
      // Table headers
      pdf.setFont(undefined, 'bold');
      pdf.text('Date', 14, yPosition);
      pdf.text('Time', 60, yPosition);
      pdf.text('Description', 100, yPosition);
      pdf.setFont(undefined, 'normal');
      yPosition += lineHeight;
      
      // Draw header line below the headers
      pdf.line(14, yPosition, pageWidth - 14, yPosition);
      yPosition += 3;
      
      // Sort all entries by date (newest first)
      const allEntries = [...diaryEntries.value].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      for (const entry of allEntries) {
        // Check if we need a new page
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
          
          // Repeat headers on new page
          pdf.setFont(undefined, 'bold');
          pdf.text('Date', 14, yPosition);
          pdf.text('Time', 60, yPosition);
          pdf.text('Description', 100, yPosition);
          pdf.setFont(undefined, 'normal');
          yPosition += lineHeight;
          pdf.line(14, yPosition, pageWidth - 14, yPosition);
          yPosition += 3;
        }
        
        // Format date and time
        const entryDate = new Date(entry.created_at);
        const dateStr = entryDate.toLocaleDateString();
        const timeStr = entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add table row
        pdf.text(dateStr, 14, yPosition);
        pdf.text(timeStr, 60, yPosition);
        
        // Handle description with text wrapping
        const descriptionWidth = pageWidth - 114; // 100 + 14 margin
        const splitDescription = pdf.splitTextToSize(entry.description, descriptionWidth);
        pdf.text(splitDescription, 100, yPosition);
        
        // Calculate row height based on description length
        const rowHeight = Math.max(lineHeight, splitDescription.length * lineHeight);
        yPosition += rowHeight + 2;
      }
    } else {
      pdf.text('No diary entries available', 14, yPosition);
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

// Fetch diary entries
async function fetchDiaryEntries() {
  try {
    const response = await fetch(`/api/apps/diaryReport/listDiary?patientID=${patientId}`);
    const result = await response.json();
    
    if (result.statusCode === 200) {
      diaryEntries.value = result.data || [];
    } else {
      console.warn('Failed to load diary entries:', result.message);
    }
  } catch (error) {
    console.error('Error fetching diary entries:', error);
  }
}



// Format timestamp for display
function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString();
}

// Group entries by date
function groupEntriesByDate(entries) {
  const grouped = {};
  
  entries.forEach(entry => {
    const date = new Date(entry.created_at).toDateString();
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  });
  
  return grouped;
}

// Format date for display
function formatDateForGroup(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Toggle date expansion
function toggleDate(date) {
  if (expandedDates.value.has(date)) {
    expandedDates.value.delete(date);
  } else {
    expandedDates.value.add(date);
  }
}

// Check if date is expanded
function isDateExpanded(date) {
  return expandedDates.value.has(date);
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
            <div>
              <p class="text-sm font-medium text-gray-500">OKU Card</p>
              <p class="text-base">{{ selectedPatient.OKUCard === 1 ? 'Yes' : 'No' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-500">Treatment Type</p>
              <p class="text-base">{{ selectedPatient.treatment_type || 'N/A' }}</p>
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

        <!-- Diary Entries Section -->
        <div class="border rounded-lg overflow-hidden">
          <div class="bg-purple-50 px-4 py-2 border-b">
            <h3 class="text-lg font-medium text-purple-800">Diary Entries</h3>
          </div>
          <div class="bg-white p-4">
            <!-- Diary Entries List -->
            <div>
              <h4 class="text-md font-medium text-gray-700 mb-3">Diary Entries</h4>
              <div v-if="diaryEntries.length === 0" class="text-center py-8 text-gray-500">
                <Icon name="material-symbols:description" size="48" class="mx-auto mb-2 text-gray-300" />
                <p>No diary entries available for this patient.</p>
              </div>
              <div v-else class="space-y-6">
                                <div
                  v-for="(entries, date) in groupEntriesByDate(diaryEntries)"
                  :key="date"
                  class="border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <!-- Date Header -->
                  <div class="flex justify-between items-center p-4 cursor-pointer" @click="toggleDate(date)">
                    <div class="flex items-center space-x-3">
                      <Icon 
                        :name="isDateExpanded(date) ? 'material-symbols:expand-less' : 'material-symbols:expand-more'" 
                        class="text-gray-500 transition-transform"
                      />
                      <h5 class="text-lg font-semibold text-gray-800">{{ formatDateForGroup(date) }}</h5>
                      <span class="text-sm text-gray-500">({{ entries.length }} entries)</span>
                    </div>
                    <span class="text-xs text-gray-400">
                      {{ isDateExpanded(date) ? 'Minimize' : 'View' }}
                    </span>
                  </div>
                  
                  <!-- Entries for this date -->
                  <div 
                    v-show="isDateExpanded(date)"
                    class="px-4 pb-4 border-t border-gray-100"
                  >
                    <div class="space-y-3 mt-3">
                      <div
                        v-for="entry in entries"
                        :key="entry.diary_id"
                        class="border border-gray-200 rounded-lg p-4 bg-white"
                      >
                        <div class="flex justify-between items-start mb-2">
                          <span class="text-sm text-gray-500">{{ formatTimestamp(entry.created_at) }}</span>
                        </div>
                        <p class="text-gray-800 whitespace-pre-wrap">{{ entry.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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