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
const registeredIDs = ref({ userID: null, parentID: null });

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
  relationship: null,
  gender: '',
  dateOfBirth: '',
  nationality: null,
  address1: '',
  address2: '',
  address3: '',
  city: '',
  postcode: '',
  state: null,
  status: '',
});

const relationshipOptions = ref([]);
const nationalityOptions = ref([]);
const stateOptions = ref([]);
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
    console.error('Username check error:', err);
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

onMounted(async () => {
  try {
    const [relRes, natRes, stateRes, roleRes] = await Promise.all([
      fetch('/api/parents/lookupRelationship'),
      fetch('/api/parents/lookupNationality'),
      fetch('/api/parents/lookupState'),
      fetch('/api/parents/lookupRole'),
    ]);

    relationshipOptions.value = [
      { label: '-- Please select --', value: '' },
      ...await relRes.json().then(data => data.map(i => ({ label: i.title, value: i.lookupID })))
    ];
    nationalityOptions.value = [
      { label: '-- Please select --', value: '' },
      ...await natRes.json().then(data => data.map(i => ({ label: i.title, value: i.lookupID })))
    ];
    stateOptions.value = [
      { label: '-- Please select --', value: '' },
      ...await stateRes.json().then(data => data.map(i => ({ label: i.title, value: i.lookupID })))
    ];
    roleOptions.value = [
      { label: '-- Please select --', value: '' },
      ...await roleRes.json().then(data => data.map(i => ({ label: i.roleName, value: i.roleID })))
    ];
  } catch (err) {
    console.error('Dropdown fetch error:', err);
  }
});

async function handleStep1Submit() {
  if (usernameError.value) {
    showMessage('Please fix the username before continuing.', 'error');
    return;
  }
  if (confirmPasswordError.value) {
    showMessage('Your confirm password does not match with your password.', 'error');
    return;
  }

  const data = {
    ...step1Form.value,
    ...step2Form.value,
  };

  try {
    const res = await fetch('/api/parents/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.statusCode === 200) {
      registeredIDs.value = {
        userID: result?.data?.user?.userID,
        parentID: result?.data?.parent?.parent_id,
      };
      console.log('Registered IDs after step 1:', registeredIDs.value); // ✅ add this
      showMessage('Step 1 registered. Continue additional details.', 'success');
      showStep2Modal.value = true;
    } else {
      showMessage(result.message || 'Registration failed', 'error');
    }
  } catch (err) {
    console.error('Submit error:', err);
    showMessage('Unexpected error occurred', 'error');
  }
}

async function submitStep2() {
  if (!registeredIDs.value.parentID) {
    showMessage('Parent ID is missing. Please re-register.', 'error');
    return;
  }

  const payload = {
    parentID: registeredIDs.value.parentID,
    ...step2Form.value,
  };

  try {
    console.log('Submitting Step 2 with payload:', payload);

    const res = await fetch('/api/parents/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (result.statusCode === 200) {
      showMessage('Parent details updated successfully');
      router.push('/userManagement/parent/parents');
    } else {
      showMessage(result.message || 'Update failed', 'error');
    }
  } catch (err) {
    console.error('Step 2 update error:', err);
    showMessage('Unexpected error occurred', 'error');
  }
}


</script>


<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Practitioner Registration - Step 1</h1>

    <!-- Step 1 Form -->
    <FormKit type="form" :actions="false">
      <FormKit
        type="text"
        name="parentUsername"
        v-model="step1Form.username"
        label="Username"
        validation="required"
        validation-visibility="live"
        autocomplete="off"
        placeholder="Enter Username"
      />
      <p v-if="usernameError" class="text-red-500 text-sm mt-1 mb-2">{{ usernameError }}</p>

      <FormKit
        type="text"
        name="parentFullname"
        v-model="step1Form.fullname"
        label="Fullname"
        validation="required"
        placeholder="Enter Fullname"
      />
      <FormKit
        type="text"
        name="parentEmail"
        v-model="step1Form.email"
        label="Email"
        validation="required"
        placeholder="Enter Email"
      />
      <FormKit
        type="text"
        name="parentIC"
        v-model="step1Form.ic"
        label="IC / MyKid / Passport"
        validation="required"
        placeholder="Example: 123456789012"
      />
      <FormKit
        type="number"
        name="parentPhone"
        v-model="step1Form.phone"
        label="Phone"
        validation="required"
        placeholder="Example: 0123456789"
      />

      <!-- Password Field -->
      <FormKit
        :type="togglePasswordVisibility ? 'text' : 'password'"
        name="registerPassword"
        v-model="step1Form.password"
        label="Password"
        validation="required"
        autocomplete="new-password"
        placeholder="Enter Password"
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
        name="registerConfirmPassword"
        v-model="step1Form.confirmPassword"
        label="Confirm Password"
        validation="required|matchesPassword"
        autocomplete="new-password"
        placeholder="Reenter Password"
        :validation-rules="{
          matchesPassword: (value) => {
            return value === step1Form.password || 'Passwords do not match';
          }
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
      <p v-if="confirmPasswordError" class="text-red-500 text-sm mt-1 mb-2">{{ confirmPasswordError }}</p>

      <FormKit
        type="select"
        name="parentRole"
        v-model="step1Form.role"
        label="Role"
        validation="required"
        :options="roleOptions"
      />

      <div class="flex justify-end mt-4">
        <rs-button @click="handleStep1Submit">Submit & Continue</rs-button>
      </div>

      <!-- Feedback message -->
      <div v-if="message" class="mb-4 p-3 rounded text-white"
           :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
        {{ message }}
      </div>
    </FormKit>

    <!-- Step 2 Modal -->
    <rs-modal
      v-model="showStep2Modal"
      title="Additional Parent Info"
      :overlay-close="false"
      :hide-footer="true"
    >
      <FormKit type="form" :actions="false" autocomplete="off">
        <div v-if="message" class="mb-4 p-3 rounded text-white"
             :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
          {{ message }}
        </div>

        <FormKit
          type="select"
          v-model="step2Form.relationship"
          name="relationship"
          label="Relationship"
          :options="relationshipOptions"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="step2Form.gender"
          name="gender"
          label="Gender"
          :options="['-- Please select --', 'Male', 'Female']"
          validation="required"
        />
        <FormKit
          type="date"
          v-model="step2Form.dateOfBirth"
          name="dateOfBirth"
          label="Date of Birth"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="step2Form.nationality"
          name="nationality"
          label="Nationality"
          :options="nationalityOptions"
          validation="required"
        />
        <FormKit
          type="text"
          v-model="step2Form.addressLine1"
          name="address1"
          label="Address Line 1"
          validation="required"
        />
        <FormKit
          type="text"
          v-model="step2Form.addressLine2"
          name="address2"
          label="Address Line 2"
        />
        <FormKit
          type="text"
          v-model="step2Form.addressLine3"
          name="address3"
          label="Address Line 3"
        />

        <FormKit
          type="text"
          v-model="step2Form.city"
          name="city"
          label="City"
          validation="required"
        />
        <FormKit
          type="text"
          v-model="step2Form.postcode"
          name="postcode"
          label="Postcode"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="step2Form.state"
          name="state"
          label="State"
          :options="stateOptions"
          validation="required"
        />
        <FormKit
          type="select"
          v-model="step2Form.status"
          name="status"
          label="Status"
          :options="['-- Please select --', 'Active', 'Inactive']"
          validation="required"
        />

        <div class="flex justify-end gap-2 mt-4">
          <rs-button @click="submitStep2">Submit</rs-button>
          <rs-button variant="outline" @click="showStep2Modal = false">Update Later</rs-button>
          <rs-button variant="ghost" @click="showStep2Modal = false">Cancel</rs-button>
        </div>
      </FormKit>
    </rs-modal>
    <div v-if="message" class="mb-4 p-3 rounded text-white"
          :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>
  </div>
</template>
