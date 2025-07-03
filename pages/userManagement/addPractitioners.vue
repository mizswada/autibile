<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const showStep2Modal = ref(false);
const usernameError = ref('');
const message = ref('');
const messageType = ref('success');
const togglePasswordVisibility = ref(false);
const togglePasswordVisibility2 = ref(false);
const confirmPasswordError = ref('');
const registeredIDs = ref({ userID: null, practitionerID: null });
const isSubmittingStep1 = ref(false);
const isSubmittingStep2 = ref(false);
const isLoading = ref(false);

// Custom validation messages
const emailError = ref('');
const phoneError = ref('');
const icError = ref('');
const passwordError = ref('');

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

const step1Form = ref({
  username: '',
  fullname: '',
  email: '',
  ic: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: '3',
});

const step2Form = ref({
  type: '',
  registrationNo: '',
  specialty: '',
  department: '',
  qualification: '',
  experience_years: null,
  signature: '',
});

const roleOptions = ref([]);

watch(() => step1Form.value.username, async (newVal) => {
  usernameError.value = '';
  if (!newVal) return;
  try {
    const res = await fetch(`/api/parents/checkUsername?username=${encodeURIComponent(newVal)}`);
    const result = await res.json();
    if (result.statusCode === 409) {
      usernameError.value = 'Username already exists !';
    }
  } catch (err) {
    usernameError.value = 'Could not check username';
  }
});

watch(
  [() => step1Form.value.password, () => step1Form.value.confirmPassword],
  ([password, confirmPassword]) => {
    confirmPasswordError.value =
      !confirmPassword ? '' : password !== confirmPassword ? 'Passwords do not match' : '';
  }
);

// Email validation
watch(() => step1Form.value.email, (newVal) => {
  emailError.value = '';
  if (!newVal) return;
  
  // Check if email contains @ and .com
  if (!newVal.includes('@') || !newVal.includes('.')) {
    emailError.value = 'Please enter a valid email address (must include @ and a domain)';
  }
});

// Phone validation
watch(() => step1Form.value.phone, (newVal) => {
  phoneError.value = '';
  if (!newVal) return;
  
  const phoneLength = newVal.toString().length;
  if (phoneLength < 10 || phoneLength > 11) {
    phoneError.value = 'Phone number must be 10-11 digits';
  }
});

// IC validation
watch(() => step1Form.value.ic, (newVal) => {
  icError.value = '';
  if (!newVal) return;
  
  if (newVal.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
  }
});

// Password validation
watch(() => step1Form.value.password, (newVal) => {
  passwordError.value = '';
  if (!newVal) return;
  
  if (newVal.length < 8) {
    passwordError.value = 'Password must be at least 8 characters long';
  }
  
  // Check confirmation password match when password changes
  if (step1Form.value.confirmPassword && step1Form.value.confirmPassword !== newVal) {
    confirmPasswordError.value = 'Passwords do not match';
  } else {
    confirmPasswordError.value = '';
  }
});

// Confirm password validation
watch(() => step1Form.value.confirmPassword, (newVal) => {
  confirmPasswordError.value = '';
  if (!newVal) return;
  
  if (newVal !== step1Form.value.password) {
    confirmPasswordError.value = 'Passwords do not match';
  }
});

onMounted(async () => {
  isLoading.value = true;
  try {
    const [roleRes] = await Promise.all([
      fetch('/api/parents/lookupRole'),
    ]);

    roleOptions.value = [
      { label: '-- Please select --', value: '' },
      ...await roleRes.json().then(data => data.map(i => ({ label: i.roleName, value: i.roleID })))
    ];
  } catch (err) {
    showMessage('Failed to load role options. Please refresh the page.', 'error');
  } finally {
    isLoading.value = false;
  }
});

async function handleStep1Submit() {
  // Check for validation errors
  if (usernameError.value || emailError.value || phoneError.value || icError.value || passwordError.value || confirmPasswordError.value) {
    showMessage('Please fix all validation errors before submitting.', 'error');
    return;
  }
  
  // Validate email
  if (!step1Form.value.email.includes('@') || !step1Form.value.email.includes('.')) {
    emailError.value = 'Please enter a valid email address (must include @ and a domain)';
    showMessage('Please enter a valid email address.', 'error');
    return;
  }
  
  // Validate phone
  const phoneLength = step1Form.value.phone.toString().length;
  if (phoneLength < 10 || phoneLength > 11) {
    phoneError.value = 'Phone number must be 10-11 digits';
    showMessage('Phone number must be 10-11 digits.', 'error');
    return;
  }
  
  // Validate IC
  if (step1Form.value.ic.toString().length !== 12) {
    icError.value = 'IC number must be exactly 12 digits';
    showMessage('IC number must be exactly 12 digits.', 'error');
    return;
  }
  
  // Validate password length
  if (step1Form.value.password.length < 8) {
    passwordError.value = 'Password must be at least 8 characters long';
    showMessage('Password must be at least 8 characters long.', 'error');
    return;
  }
  
  // Validate password confirmation
  if (step1Form.value.password !== step1Form.value.confirmPassword) {
    confirmPasswordError.value = 'Passwords do not match';
    showMessage('Passwords do not match.', 'error');
    return;
  }
  
  isSubmittingStep1.value = true;

  const data = {
    ...step1Form.value,
    ...step2Form.value,
  };

  try {
    const res = await fetch('/api/practitioners/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      registeredIDs.value = {
        userID: result?.data?.user?.userID,
        practitionerID: result?.data?.practitioner?.practitioner_id,
      };
      showMessage('Step 1 registered. Continue additional details.', 'success');
      showStep2Modal.value = true;
    } else {
      showMessage(result.message || 'Registration failed', 'error');
    }
  } catch (err) {
    showMessage('Unexpected error occurred', 'error');
  } finally {
    isSubmittingStep1.value = false;
  }
}

async function submitStep2() {
  if (!registeredIDs.value.practitionerID) {
    showMessage('Practitioner ID is missing. Please re-register.', 'error');
    return;
  }
  
  isSubmittingStep2.value = true;

  const payload = {
    practitionerID: registeredIDs.value.practitionerID,
    userID: registeredIDs.value.userID,
    type: step2Form.value.type,
    registrationNo: step2Form.value.registrationNo,
    specialty: step2Form.value.specialty,
    department: step2Form.value.department,
    qualification: step2Form.value.qualification,
    experience: parseInt(step2Form.value.experience_years),
    signature: step2Form.value.signature || null,
  };

  // The signature should already be a base64 string from handleSignatureUpload
  // If it's still a File object, we need to handle that case
  if (step2Form.value.signature instanceof File) {
    try {
      const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
      payload.signature = await toBase64(step2Form.value.signature);
    } catch (error) {
      payload.signature = null;
    }
  }

  try {
    const res = await fetch('/api/practitioners/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      showMessage('Practitioner details updated successfully');
      router.push('/userManagement/practitioners');
    } else {
      showMessage(result.message || 'Update failed', 'error');
    }
  } catch (err) {
    showMessage('Unexpected error occurred', 'error');
  } finally {
    isSubmittingStep2.value = false;
  }
}

function handleSignatureUpload(fileList) {
  const file = fileList?.[0]?.file || fileList?.[0];
  if (file instanceof File) {
    // Convert file to base64 immediately to avoid issues
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      step2Form.value.signature = reader.result;
    };
    reader.onerror = error => {
      step2Form.value.signature = '';
    };
  } else {
    step2Form.value.signature = '';
  }
}

</script>


<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Practitioner Registration - Step 1</h1>

    <!-- Feedback message -->
    <div v-if="message" class="mb-4 p-3 rounded text-white"
         :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="flex flex-col items-center">
        <Icon name="line-md:loading-twotone-loop" size="48" class="text-primary mb-2" />
        <span>Loading form data...</span>
      </div>
    </div>

    <!-- Step 1 Form -->
    <div v-else class="card p-4">
      <FormKit type="form" :actions="false">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormKit
              type="text"
              name="username"
              v-model="step1Form.username"
              label="Username"
              validation="required"
              validation-visibility="live"
              autocomplete="off"
              placeholder="Enter username"
            />
            <p v-if="usernameError" class="text-red-500 text-sm mt-1">{{ usernameError }}</p>
          </div>

          <FormKit
            type="text"
            name="fullname"
            v-model="step1Form.fullname"
            label="Fullname"
            validation="required"
            placeholder="Enter fullname"
          />

          <div>
            <FormKit
              type="text"
              name="email"
              v-model="step1Form.email"
              label="Email"
              validation="required"
              placeholder="Enter email"
            />
            <p v-if="emailError" class="text-red-500 text-sm mt-1">{{ emailError }}</p>
          </div>

          <div>
            <FormKit
              type="text"
              name="ic"
              v-model="step1Form.ic"
              label="IC / MyKid / Passport"
              validation="required"
              placeholder="Enter identification number"
            />
            <p v-if="icError" class="text-red-500 text-sm mt-1">{{ icError }}</p>
          </div>

          <div>
            <FormKit
              type="text"
              name="phone"
              v-model="step1Form.phone"
              label="Phone"
              validation="required"
              placeholder="Enter phone number"
            />
            <p v-if="phoneError" class="text-red-500 text-sm mt-1">{{ phoneError }}</p>
          </div>

          <!-- Password Field -->
          <FormKit
            :type="togglePasswordVisibility ? 'text' : 'password'"
            name="password"
            v-model="step1Form.password"
            label="Password"
            validation="required|length:8"
            autocomplete="new-password"
            placeholder="Enter password"
          >
            <template #suffix>
              <div class="h-full px-3 flex items-center cursor-pointer"
                   @click="togglePasswordVisibility = !togglePasswordVisibility">
                <Icon
                  :name="togglePasswordVisibility ? 'ion:eye-off-outline' : 'ion:eye-outline'"
                  size="19"
                />
              </div>
            </template>
          </FormKit>

          <!-- Confirm Password Field -->
          <FormKit
            :type="togglePasswordVisibility2 ? 'text' : 'password'"
            name="confirmPassword"
            v-model="step1Form.confirmPassword"
            label="Confirm Password"
            validation="required|confirmed:password"
            autocomplete="new-password"
            placeholder="Confirm password"
            :validation-rules="{
              confirmed: (value) => value === step1Form.password || 'Passwords do not match'
            }"
          >
            <template #suffix>
              <div class="h-full px-3 flex items-center cursor-pointer"
                   @click="togglePasswordVisibility2 = !togglePasswordVisibility2">
                <Icon
                  :name="togglePasswordVisibility2 ? 'ion:eye-off-outline' : 'ion:eye-outline'"
                  size="19"
                />
              </div>
            </template>
          </FormKit>

          <FormKit
            type="select"
            name="role"
            v-model="step1Form.role"
            label="Role"
            validation="required"
            :options="roleOptions"
          />
        </div>

        <div class="flex justify-end mt-6">
          <div class="flex gap-2">
            <rs-button variant="ghost" @click="router.push('/userManagement/practitioners')">
              Cancel
            </rs-button>
            <rs-button @click="handleStep1Submit" :disabled="isSubmittingStep1">
              <span v-if="isSubmittingStep1">
                <Icon name="line-md:loading-twotone-loop" class="mr-2" />
                Submitting...
              </span>
              <span v-else>Submit & Continue</span>
            </rs-button>
          </div>
        </div>
      </FormKit>
    </div>

    <!-- Step 2 Modal -->
    <rs-modal
      v-model="showStep2Modal"
      title="Additional Practitioner Info"
      :overlay-close="false"
      :hide-footer="true"
      size="xl"
    >
      <!-- Update Later button at the top -->
      <div class="flex justify-end mb-4">
        <rs-button 
          variant="warning" 
          class="bg-amber-500 hover:bg-amber-600 text-white" 
          @click="router.push('/userManagement/practitioners')"
        >
          <Icon name="material-symbols:update" class="mr-1" />
          Update Later
        </rs-button>
      </div>
      
      <FormKit type="form" :actions="false" autocomplete="off">
        <div v-if="message" class="mb-4 p-3 rounded text-white"
             :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
          {{ message }}
        </div>

        <FormKit
          type="select"
          v-model="step2Form.type"
          name="type"
          label="Practitioner Type"
          :options="['-- Select Type --', 'Doctor', 'Therapist', 'Nurse', 'Other']"
          validation="required"
        />

        <FormKit
          type="text"
          v-model="step2Form.registrationNo"
          name="registrationNo"
          label="Registration Number"
          validation="required"
        />

        <FormKit
          type="text"
          v-model="step2Form.specialty"
          name="specialty"
          label="Specialty"
        />

        <FormKit
          type="text"
          v-model="step2Form.department"
          name="department"
          label="Department"
        />

        <FormKit
          type="text"
          v-model="step2Form.qualification"
          name="qualification"
          label="Qualifications"
          validation="required"
        />

        <FormKit
          type="number"
          v-model="step2Form.experience_years"
          name="experience_years"
          label="Years of Experience"
          validation="required"
        />

        <FormKit
          type="file"
          v-model="step2Form.signature"
          name="signature"
          label="Signature (Optional)"
          accept="image/*"
          @input="handleSignatureUpload"
        />

        <div class="flex justify-end gap-2 mt-4">
          <rs-button @click="submitStep2" :disabled="isSubmittingStep2">
            <span v-if="isSubmittingStep2">
              <Icon name="line-md:loading-twotone-loop" class="mr-2" />
              Submitting...
            </span>
            <span v-else>Submit</span>
          </rs-button>
          <rs-button variant="ghost" @click="showStep2Modal = false">Cancel</rs-button>
        </div>
      </FormKit>
    </rs-modal>
  </div>
</template>

<style scoped>
/* Add custom styles here if needed */
</style>
