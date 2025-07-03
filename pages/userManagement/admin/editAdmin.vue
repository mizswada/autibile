<script setup>
// Added by: Firzana Huda
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const roles = ref([]);
const form = ref({
  username: '',
  fullName: '',
  email: '',
  phone: '',
  ic: '',
  password: '',
  confirmPassword: '',
  selectedRoles: [],
  status: ''
});

// Track original roles to detect changes
const originalRoles = ref([]);
const rolesChanged = ref(false);

const isSubmitting = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const message = ref('');
const messageType = ref('success');

function showMessage(msg, type = 'success') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => (message.value = ''), 3000);
}

onMounted(async () => {
  const userID = route.query.userID;
  if (!userID) {
    showMessage('Missing administrator ID', 'error');
    router.push('/userManagement/admin/adminPage');
    return;
  }

  try {
    const [rolesRes, adminRes] = await Promise.all([
      fetch('/api/admin/listRoles'),
      fetch(`/api/admin/fetchAdmin?userID=${userID}`),
    ]);

    const rolesData = await rolesRes.json();
    const adminData = await adminRes.json();

    if (adminData.statusCode !== 200) {
      showMessage('Administrator not found', 'error');
      router.push('/userManagement/admin/adminPage');
      return;
    }

    const data = adminData.data;

    // Format roles for display
    roles.value = rolesData.data.map(role => ({
      id: role.roleID,
      name: role.roleName,
      description: role.roleDescription || '',
    }));

    // Save original roles to detect changes
    originalRoles.value = [...(data.roleIDs || [])].sort();
    
    // Populate the form with admin data
    form.value = {
      username: data.username || '',
      fullName: data.fullName || '',
      email: data.email || '',
      phone: data.phone || '',
      ic: data.ic || '',
      password: '',
      confirmPassword: '',
      selectedRoles: data.roleIDs || [],
      status: data.status || ''
    };
  } catch (err) {
    console.error('Error fetching data:', err);
    showMessage('An error occurred while fetching administrator data', 'error');
    router.push('/userManagement/admin/adminPage');
  }
});

async function updateAdmin() {
  if (usernameError.value || emailError.value || phoneError.value || icError.value) {
    showMessage('Please fix all validation errors before submitting.', 'error');
    return;
  }
  
  if (form.value.selectedRoles.length === 0) {
    showMessage('At least one role must be selected.', 'error');
    return;
  }
  
  isSubmitting.value = true;
  
  try {
    const response = await fetch(`/api/admin/updateAdmin?adminID=${adminID.value}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: form.value.username,
        fullName: form.value.fullname,
        email: form.value.email,
        phone: form.value.phone || '',
        ic: form.value.ic,
        roleIDs: form.value.selectedRoles
      })
    });
    
    const result = await response.json();
    
    if (result.statusCode === 200) {
      showMessage('Administrator updated successfully');
      setTimeout(() => {
        router.push('/userManagement/admin/adminPage');
      }, 1000);
    } else {
      showMessage(`Error updating administrator: ${result.message}`, 'error');
    }
  } catch (error) {
    showMessage('An error occurred while updating the administrator', 'error');
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
  
  // Check if roles have changed from original
  const currentRoles = [...form.value.selectedRoles].sort();
  rolesChanged.value = JSON.stringify(currentRoles) !== JSON.stringify(originalRoles.value);
}

function isRoleSelected(roleId) {
  return form.value.selectedRoles.includes(roleId);
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">Update Administrator</h1>

    <!-- Feedback message -->
    <div v-if="message" class="mb-4 p-3 rounded text-white"
        :class="messageType === 'success' ? 'bg-green-500' : 'bg-red-500'">
      {{ message }}
    </div>

    <FormKit type="form" :actions="false" class="bg-white shadow-sm rounded-lg p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Username (disabled) -->
        <div>
          <FormKit
            type="text"
            v-model="form.username"
            label="Username *"
            disabled
          />
        </div>
        
        <!-- Full Name -->
        <div>
          <FormKit
            type="text"
            v-model="form.fullName"
            label="Full Name *"
            validation="required"
          />
        </div>

        <!-- Email and Phone -->
        <div>
          <FormKit
            type="email"
            v-model="form.email"
            label="Email *"
            validation="required|email"
          />
        </div>
        
        <div>
          <FormKit
            type="tel"
            v-model="form.phone"
            label="Phone"
          />
        </div>

        <!-- IC Number -->
        <div>
          <FormKit
            type="text"
            v-model="form.ic"
            label="IC Number *"
            validation="required"
          />
        </div>

        <!-- Password (optional) -->
        <div>
          <FormKit
            :type="showPassword ? 'text' : 'password'"
            name="adminPassword"
            v-model="form.password"
            label="Password (leave blank to keep unchanged)"
            autocomplete="new-password"
          >
            <template #suffix>
              <div class="h-full px-3 flex items-center cursor-pointer"
                   @click="showPassword = !showPassword">
                <Icon
                  :name="showPassword ? 'ion:eye-off-outline' : 'ion:eye-outline'"
                  size="19"
                />
              </div>
            </template>
          </FormKit>
        </div>
        
        <!-- Confirm Password -->
        <div>
          <FormKit
            :type="showConfirmPassword ? 'text' : 'password'"
            name="adminConfirmPassword"
            v-model="form.confirmPassword"
            label="Confirm Password"
            autocomplete="new-password"
            :validation-rules="{
              confirmed: (value) => !form.password || value === form.password || 'Passwords do not match'
            }"
          >
            <template #suffix>
              <div class="h-full px-3 flex items-center cursor-pointer"
                   @click="showConfirmPassword = !showConfirmPassword">
                <Icon
                  :name="showConfirmPassword ? 'ion:eye-off-outline' : 'ion:eye-outline'"
                  size="19"
                />
              </div>
            </template>
          </FormKit>
        </div>
      </div>
      
      <!-- Roles Section -->
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

      <div class="flex gap-4 mt-6">
        <div class="w-1/2">
          <rs-button class="w-full" @click="updateAdmin" :disabled="isSubmitting">
            <span v-if="isSubmitting">
              <Icon name="line-md:loading-twotone-loop" class="mr-2" />
              Updating...
            </span>
            <span v-else>Update</span>
          </rs-button>
        </div>

        <div class="w-1/2">
          <rs-button
            class="w-full"
            variant="ghost"
            @click="router.push('/userManagement/admin/adminPage')"
          >
            Cancel
          </rs-button>
        </div>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style> 