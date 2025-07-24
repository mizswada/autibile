<script setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();
const profile = ref({
  fullName: '',
  email: '',
  phone: '',
  ic: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  // Doctor-specific fields (from user_practitioners table)
  registration_no: '',
  specialty: '',
  department: '',
  qualifications: '',
  experience_years: '',
});

const isLoading = ref(false);
const isSaving = ref(false);
const message = ref('');
const messageType = ref('success'); // 'success' or 'error'
const showPassword = ref(false);
const debugInfo = ref('');

// Computed property to check if passwords match
const passwordsMatch = computed(() => {
  if (!profile.value.newPassword && !profile.value.confirmPassword) return true;
  return profile.value.newPassword === profile.value.confirmPassword;
});

onMounted(async () => {
  await fetchUserProfile();
});

async function fetchUserProfile() {
  isLoading.value = true;
  message.value = '';
  debugInfo.value = '';
  
  try {
    const response = await fetch('/api/user/get');
    const result = await response.json();
    
    if (response.ok && result.statusCode === 200 && result.data) {
      profile.value = {
        ...profile.value,
        fullName: result.data.userFullName || '',
        email: result.data.userEmail || '',
        phone: result.data.userPhone || '',
        ic: result.data.userIC || '',
        // Load doctor-specific data if available
        registration_no: result.data.practitioner?.registration_no || '',
        specialty: result.data.practitioner?.specialty || '',
        department: result.data.practitioner?.department || '',
        qualifications: result.data.practitioner?.qualifications || '',
        experience_years: result.data.practitioner?.experience_years?.toString() || '',
      };
    } else {
      showMessage(result.message || 'Failed to load profile data', 'error');
      debugInfo.value = `Status: ${response.status}, Message: ${result.message || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    showMessage('An error occurred while loading your profile', 'error');
    debugInfo.value = `Error: ${error.message || error}`;
  } finally {
    isLoading.value = false;
  }
}

async function saveProfile() {
  // Validate form
  if (!profile.value.fullName || !profile.value.email || !profile.value.phone) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }
  
  // Validate doctor-specific fields if user is a doctor
  if (userStore.isDoctor) {
    if (!profile.value.registration_no || !profile.value.specialty || 
        !profile.value.department || !profile.value.qualifications || 
        !profile.value.experience_years) {
      showMessage('Please fill in all required professional information fields', 'error');
      return;
    }
    
    // Validate experience_years is a positive number
    const years = parseInt(profile.value.experience_years);
    if (isNaN(years) || years < 0) {
      showMessage('Please enter a valid number of years of experience', 'error');
      return;
    }
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(profile.value.email)) {
    showMessage('Please enter a valid email address', 'error');
    return;
  }
  
  // Validate password match if new password is provided
  if (profile.value.newPassword) {
    if (!profile.value.currentPassword) {
      showMessage('Current password is required to set a new password', 'error');
      return;
    }
    
    if (!passwordsMatch.value) {
      showMessage('New password and confirmation do not match', 'error');
      return;
    }
    
    if (profile.value.newPassword.length < 6) {
      showMessage('New password must be at least 6 characters long', 'error');
      return;
    }
  }
  
  isSaving.value = true;
  message.value = '';
  debugInfo.value = '';
  
  try {
    const payload = {
      fullName: profile.value.fullName,
      email: profile.value.email,
      phone: profile.value.phone,
    };
    
    // Add doctor-specific fields if user is a doctor
    if (userStore.isDoctor) {
      payload.registration_no = profile.value.registration_no;
      payload.specialty = profile.value.specialty;
      payload.department = profile.value.department;
      payload.qualifications = profile.value.qualifications;
      payload.experience_years = profile.value.experience_years;
    }
    
    // Only include password fields if changing password
    if (profile.value.newPassword) {
      payload.currentPassword = profile.value.currentPassword;
      payload.newPassword = profile.value.newPassword;
    }
    
    console.log('Sending profile update request with payload:', payload);
    
    const response = await fetch('/api/user/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    console.log('Profile update response:', result);
    
    if (response.ok && result.statusCode === 200) {
      showMessage('Profile updated successfully', 'success');
      
      // Update user store if username changed
      if (result.data && result.data.userUsername !== userStore.username) {
        userStore.setUsername(result.data.userUsername);
      }
      
      // Clear password fields
      profile.value.currentPassword = '';
      profile.value.newPassword = '';
      profile.value.confirmPassword = '';
    } else {
      showMessage(result.message || 'Failed to update profile', 'error');
      debugInfo.value = `Status: ${response.status}, Message: ${result.message || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showMessage('An error occurred while updating your profile', 'error');
    debugInfo.value = `Error: ${error.message || error}`;
  } finally {
    isSaving.value = false;
  }
}

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  
  // Auto-clear success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      if (message.value === msg) {
        message.value = '';
      }
    }, 5000);
  }
}

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Edit Profile</h1>
      <p class="text-gray-600">Update your personal information and password</p>
    </div>
    
    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading your profile...</span>
      </div>
    </div>
    
    <div v-else>
      <!-- Alert message -->
      <div v-if="message" class="mb-6 p-4 rounded" :class="messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
        {{ message }}
        <div v-if="debugInfo && messageType === 'error'" class="mt-2 text-xs border-t pt-2">
          {{ debugInfo }}
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow-md overflow-hidden">
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Personal Information Section -->
            <div class="md:col-span-2">
              <h2 class="text-lg font-semibold mb-4 pb-2 border-b">Personal Information</h2>
            </div>
            
            <FormKit
              type="text"
              v-model="profile.fullName"
              name="fullName"
              label="Full Name"
              placeholder="Enter your full name"
              validation="required"
              :validation-messages="{ required: 'Full name is required' }"
            />
            
            <FormKit
              type="email"
              v-model="profile.email"
              name="email"
              label="Email Address"
              placeholder="Enter your email address"
              validation="required|email"
              :validation-messages="{ 
                required: 'Email is required',
                email: 'Please enter a valid email address'
              }"
            />
            
            <FormKit
              type="tel"
              v-model="profile.phone"
              name="phone"
              label="Phone Number"
              placeholder="Enter your phone number"
              validation="required"
              :validation-messages="{ required: 'Phone number is required' }"
            />
            
            <FormKit
              type="text"
              v-model="profile.ic"
              name="ic"
              label="IC Number"
              placeholder="Enter your IC number"
              disabled
            />
            
            <!-- Doctor Information Section - Only show for doctors -->
            <div v-if="userStore.isDoctor" class="md:col-span-2 mt-6">
              <h2 class="text-lg font-semibold mb-4 pb-2 border-b">Professional Information</h2>
              <p class="text-sm text-gray-600 mb-4">Update your professional details and credentials</p>
            </div>
            
            <FormKit
              v-if="userStore.isDoctor"
              type="text"
              v-model="profile.registration_no"
              name="registration_no"
              label="Registration Number"
              placeholder="Enter your professional registration number"
              validation="required"
              :validation-messages="{ required: 'Registration number is required' }"
            />
            
            <FormKit
              v-if="userStore.isDoctor"
              type="text"
              v-model="profile.specialty"
              name="specialty"
              label="Specialty"
              placeholder="e.g., Child Psychology, Autism Therapy, Speech Therapy"
              validation="required"
              :validation-messages="{ required: 'Specialty is required' }"
            />
            
            <FormKit
              v-if="userStore.isDoctor"
              type="text"
              v-model="profile.department"
              name="department"
              label="Department"
              placeholder="e.g., Psychology Department, Therapy Center"
              validation="required"
              :validation-messages="{ required: 'Department is required' }"
            />
            
            <FormKit
              v-if="userStore.isDoctor"
              type="text"
              v-model="profile.qualifications"
              name="qualifications"
              label="Qualifications"
              placeholder="e.g., PhD in Psychology, Master's in Special Education"
              validation="required"
              :validation-messages="{ required: 'Qualifications are required' }"
            />
            
            <FormKit
              v-if="userStore.isDoctor"
              type="number"
              v-model="profile.experience_years"
              name="experience_years"
              label="Years of Experience"
              placeholder="Enter number of years"
              validation="required|number"
              :validation-messages="{ 
                required: 'Years of experience is required',
                number: 'Please enter a valid number'
              }"
            />
            
            <!-- Change Password Section -->
            <div class="md:col-span-2 mt-6">
              <h2 class="text-lg font-semibold mb-4 pb-2 border-b">Change Password</h2>
              <p class="text-sm text-gray-600 mb-4">Leave these fields empty if you don't want to change your password</p>
            </div>
            
            <div class="relative">
              <FormKit
                :type="showPassword ? 'text' : 'password'"
                v-model="profile.currentPassword"
                name="currentPassword"
                label="Current Password"
                placeholder="Enter your current password"
              />
              <button 
                type="button" 
                class="absolute right-3 top-9 text-gray-500"
                @click="togglePasswordVisibility"
              >
                <Icon 
                  :name="showPassword ? 'material-symbols:visibility-off-outline' : 'material-symbols:visibility-outline'" 
                  size="20"
                />
              </button>
            </div>
            
            <div class="relative">
              <FormKit
                :type="showPassword ? 'text' : 'password'"
                v-model="profile.newPassword"
                name="newPassword"
                label="New Password"
                placeholder="Enter your new password"
                validation="length:6"
                validation-visibility="dirty"
                :validation-messages="{ 
                  length: 'Password must be at least 6 characters long'
                }"
              />
            </div>
            
            <div class="relative md:col-span-2">
              <FormKit
                :type="showPassword ? 'text' : 'password'"
                v-model="profile.confirmPassword"
                name="confirmPassword"
                label="Confirm New Password"
                placeholder="Confirm your new password"
                :validation="profile.newPassword ? 'required' : ''"
                validation-visibility="dirty"
                :validation-messages="{ 
                  required: 'Please confirm your new password'
                }"
              />
              <div v-if="profile.confirmPassword && !passwordsMatch" class="text-red-500 text-sm mt-1">
                Passwords do not match
              </div>
            </div>
          </div>
          
          <!-- Form Actions -->
          <div class="mt-8 flex justify-end">
            <rs-button
              type="button"
              variant="primary"
              :disabled="isSaving"
              @click="saveProfile"
            >
              <span v-if="isSaving" class="flex items-center">
                <Icon name="line-md:loading-twotone-loop" class="mr-2" />
                Saving...
              </span>
              <span v-else>Save Changes</span>
            </rs-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
