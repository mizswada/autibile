<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const roles = ref([]);
const isSubmitting = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const usernameError = ref('');
const message = ref('');
const messageType = ref('success');

// Custom validation messages
const emailError = ref('');
const phoneError = ref('');
const icError = ref('');
const passwordError = ref('');
const confirmPasswordError = ref('');

// Form data
const form = ref({
  username: '',
  fullname: '',
  email: '',
  phone: '',
  ic: '',
  password: '',
  confirmPassword: '',
  selectedRoles: []
});

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

// Watch for username changes to check availability
watch(() => form.value.username, async (newVal) => {
  usernameError.value = '';
  if (!newVal) return;
  try {
    const res = await fetch(`/api/parents/checkUsername?username=${encodeURIComponent(newVal)}`);
    const result = await res.json();
    if (result.statusCode === 409) {
      usernameError.value = 'Username already exists!';
    }
  } catch (err) {
    usernameError.value = 'Could not check username';
  }
});

// Email validation
watch(() => form.value.email, (newVal) => {
  emailError.value = '';
  if (!newVal) return;
  
  // Check if email contains @ and .com
  if (!newVal.includes('@') || !newVal.includes('.')) {
    emailError.value = 'Please enter a valid email address (must include @ and a domain)';
  }
});

// Phone validation
watch(() => form.value.phone, (newVal) => {
  phoneError.value = '';
  if (!newVal) return;
  
  const phoneLength = newVal.toString().length;
  if (phoneLength < 10 || phoneLength > 11) {
    phoneError.value = 'Phone number must be 10-11 digits';
  }
});

// IC validation
watch(() => form.value.ic, (newVal) => {
  icError.value = '';
  if (!newVal) return;
  
  if (newVal.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
  }
});

// Password validation
watch(() => form.value.password, (newVal) => {
  passwordError.value = '';
  if (!newVal) return;
  
  if (newVal.length < 8) {
    passwordError.value = 'Password must be at least 8 characters long';
  }
  
  // Check confirmation password match when password changes
  if (form.value.confirmPassword && form.value.confirmPassword !== newVal) {
    confirmPasswordError.value = 'Passwords do not match';
  } else {
    confirmPasswordError.value = '';
  }
});

// Confirm password validation
watch(() => form.value.confirmPassword, (newVal) => {
  confirmPasswordError.value = '';
  if (!newVal) return;
  
  if (newVal !== form.value.password) {
    confirmPasswordError.value = 'Passwords do not match';
  }
});

onMounted(async () => {
  await loadRoles();
});

async function loadRoles() {
  try {
    const response = await fetch('/api/admin/listRoles');
    const result = await response.json();
    
    if (result.statusCode === 200) {
      roles.value = result.data.map(role => ({
        id: role.roleID,
        name: role.roleName,
        description: role.roleDescription || '',
        selected: role.roleName.includes('Admin') // Pre-select admin roles
      }));
      
      // Initialize selectedRoles with pre-selected roles
      form.value.selectedRoles = roles.value
        .filter(role => role.selected)
        .map(role => role.id);
    } else {
      console.error('Failed to load roles:', result.message);
    }
  } catch (error) {
    console.error('Error loading roles:', error);
  }
}

async function submitForm() {
  // Validate form
  if (usernameError.value || emailError.value || phoneError.value || icError.value || passwordError.value || confirmPasswordError.value) {
    showMessage('Please fix all validation errors before submitting.', 'error');
    return;
  }

  // Validate password length
  if (form.value.password.length < 8) {
    passwordError.value = 'Password must be at least 8 characters long';
    showMessage('Password must be at least 8 characters long.', 'error');
    return;
  }

  // Validate password confirmation
  if (form.value.password !== form.value.confirmPassword) {
    confirmPasswordError.value = 'Passwords do not match';
    showMessage('Passwords do not match.', 'error');
    return;
  }

  if (form.value.selectedRoles.length === 0) {
    showMessage('At least one role must be selected.', 'error');
    return;
  }
  
  isSubmitting.value = true;
  
  try {
    const response = await fetch('/api/admin/addAdmin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: form.value.username,
        fullName: form.value.fullname,
        email: form.value.email,
        phone: form.value.phone || '',
        ic: form.value.ic,
        password: form.value.password,
        roleIDs: form.value.selectedRoles
      })
    });
    
    const result = await response.json();
    
    if (result.statusCode === 200) {
      showMessage('Administrator created successfully');
      setTimeout(() => {
        router.push('/userManagement/admin/adminPage');
      }, 1000);
    } else {
      showMessage(`Error creating administrator: ${result.message}`, 'error');
    }
  } catch (error) {
    showMessage('An error occurred while creating the administrator', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

function toggleRoleSelection(roleId) {
  const index = form.value.selectedRoles.indexOf(roleId);
  if (index === -1) {
    form.value.selectedRoles.push(roleId);
  } else {
    form.value.selectedRoles.splice(index, 1);
  }
}

function isRoleSelected(roleId) {
  return form.value.selectedRoles.includes(roleId);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Add Administrator</h1>
    
    <FormKit type="form" :actions="false" class="mt-6 bg-white shadow-sm rounded-lg p-6">
      <!-- Feedback message -->
      <div v-if="message" class="mb-4 p-3 rounded text-white"
           :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
        {{ message }}
      </div>
      
      <!-- Username and Full Name -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <FormKit
            type="text"
            name="adminUsername"
            v-model="form.username"
            label="Username *"
            validation="required"
            validation-visibility="live"
            autocomplete="off"
            placeholder="Enter username"
          />
          <p v-if="usernameError" class="text-red-500 text-xs mt-1">{{ usernameError }}</p>
        </div>
        
        <div>
          <FormKit
            type="text"
            name="adminFullName"
            v-model="form.fullname"
            label="Full Name *"
            validation="required"
            placeholder="Enter full name"
          />
        </div>
      </div>
      
      <!-- Email and Phone -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <FormKit
            type="text"
            name="adminEmail"
            v-model="form.email"
            label="Email *"
            validation="required"
            placeholder="Enter email"
          />
          <p v-if="emailError" class="text-red-500 text-xs mt-1">{{ emailError }}</p>
        </div>
        
        <div>
          <FormKit
            type="text"
            name="adminPhone"
            v-model="form.phone"
            label="Phone Number"
            placeholder="Enter phone number"
          />
          <p v-if="phoneError" class="text-red-500 text-xs mt-1">{{ phoneError }}</p>
        </div>
      </div>
      
      <!-- IC -->
      <div class="mb-6">
        <FormKit
          type="text"
          name="adminIC"
          v-model="form.ic"
          label="IC Number *"
          validation="required"
          placeholder="Enter IC number (12 digits)"
        />
        <p v-if="icError" class="text-red-500 text-xs mt-1">{{ icError }}</p>
      </div>
      
      <!-- Password and Confirm Password -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="relative">
          <FormKit
            :type="showPassword ? 'text' : 'password'"
            name="adminPassword"
            v-model="form.password"
            label="Password *"
            validation="required"
            placeholder="Enter password (min 8 characters)"
          >
            <template #suffix>
              <span @click="showPassword = !showPassword" class="cursor-pointer">
                <Icon :name="showPassword ? 'ion:eye-off-outline' : 'ion:eye-outline'" class="text-gray-500" />
              </span>
            </template>
          </FormKit>
          <p v-if="passwordError" class="text-red-500 text-xs mt-1">{{ passwordError }}</p>
        </div>
        
        <div class="relative">
          <FormKit
            :type="showConfirmPassword ? 'text' : 'password'"
            name="adminConfirmPassword"
            v-model="form.confirmPassword"
            label="Confirm Password *"
            validation="required"
            placeholder="Confirm your password"
          >
            <template #suffix>
              <span @click="showConfirmPassword = !showConfirmPassword" class="cursor-pointer">
                <Icon :name="showConfirmPassword ? 'ion:eye-off-outline' : 'ion:eye-outline'" class="text-gray-500" />
              </span>
            </template>
          </FormKit>
          <p v-if="confirmPasswordError" class="text-red-500 text-xs mt-1">{{ confirmPasswordError }}</p>
        </div>
      </div>
      
      <!-- Roles -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Roles *</label>
        <div class="bg-gray-50 border border-gray-200 rounded-md p-4 max-h-60 overflow-y-auto">
          <div v-if="roles.length === 0" class="text-gray-500 text-sm">Loading roles...</div>
          <div v-else class="space-y-2">
            <div 
              v-for="role in roles" 
              :key="role.id" 
              class="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
              @click="toggleRoleSelection(role.id)"
            >
              <input
                type="checkbox"
                :checked="isRoleSelected(role.id)"
                class="mr-3 h-5 w-5 text-blue-600 rounded"
                @click.stop
                @change="toggleRoleSelection(role.id)"
              />
              <div>
                <div class="font-medium">{{ role.name }}</div>
                <div class="text-sm text-gray-500" v-if="role.description">{{ role.description }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Form Actions -->
      <div class="flex gap-4 justify-end">
        <rs-button 
          variant="ghost" 
          class="px-6"
          @click="router.push('/userManagement/admin/adminPage')"
          type="button"
        >
          Cancel
        </rs-button>
        
        <rs-button 
          class="px-6"
          :disabled="isSubmitting"
          @click="submitForm"
        >
          <span v-if="isSubmitting">
            <Icon name="line-md:loading-twotone-loop" class="mr-2" />
            Saving...
          </span>
          <span v-else>Save</span>
        </rs-button>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style> 