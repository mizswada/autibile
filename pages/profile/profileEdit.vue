<script setup>
import { ref } from 'vue';

const profile = ref({
  name: 'Admin User',
  email: 'admin@email.com',
  password: '',
  city: 'Kuala Lumpur',
  zipcode: '50000',
  profilePicture: null,
});

function saveProfile() {
  // Implement save logic here
  console.log('Save profile', profile.value);
}

function onFileChange(event) {
  const file = event.target.files[0];
  profile.value.profilePicture = file;
}
</script>

<template>
  <div class="mb-4 max-w-lg mx-auto">
    <h1 class="text-2xl font-bold mb-4">Edit Admin Profile</h1>
    <div class="card p-4">
      <FormKit type="form" @submit="saveProfile">
        <FormKit type="text" v-model="profile.name" name="name" label="Admin Name" />
        <FormKit type="email" v-model="profile.email" name="email" label="Email" />
        <FormKit type="password" v-model="profile.password" name="password" label="Password" />
        <FormKit type="text" v-model="profile.city" name="city" label="City" />
        <FormKit type="text" v-model="profile.zipcode" name="zipcode" label="Zip Code" />
        <div class="mb-4">
          <label class="block font-medium mb-1">Profile Picture</label>
          <input type="file" accept="image/*" @change="onFileChange" />
          <div v-if="profile.profilePicture" class="mt-2">
            <img
              :src="URL.createObjectURL(profile.profilePicture)"
              alt="Profile Picture Preview"
              class="w-24 h-24 object-cover rounded-full border"
            />
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <rs-button type="submit" variant="primary">Save</rs-button>
        </div>
      </FormKit>
    </div>
  </div>
</template>
