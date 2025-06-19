<script setup>
import { ref } from 'vue';

const posts = ref([
  {
    id: 1,
    author: "John Doe",
    title: "Support for New Diagnosis",
    content: "We just received a diagnosis for our child. Any advice is appreciated.",
    date: "2024-06-01",
    flagged: false,
    action: "edit",
  },
  {
    id: 2,
    author: "Jane Smith",
    title: "Therapy Recommendations",
    content: "Looking for recommendations for speech therapy in KL.",
    date: "2024-06-02",
    flagged: false,
    action: "edit",
  },
  {
    id: 3,
    author: "Spam User",
    title: "Buy cheap products!",
    content: "Visit spamwebsite.com for cheap deals.",
    date: "2024-06-03",
    flagged: true,
    action: "edit",
  }
]);

const showModal = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const newPost = ref({
  author: '',
  title: '',
  content: '',
  date: '',
  flagged: false,
});

function openEditModal(post) {
  newPost.value = { ...post };
  isEdit.value = true;
  editId.value = post.id;
  showModal.value = true;
}

function openAddModal() {
  newPost.value = {
    author: '',
    title: '',
    content: '',
    date: new Date().toISOString().slice(0, 10),
    flagged: false,
  };
  isEdit.value = false;
  editId.value = null;
  showModal.value = true;
}

function savePost() {
  if (newPost.value.title.trim() && newPost.value.content.trim()) {
    if (isEdit.value && editId.value !== null) {
      const idx = posts.value.findIndex(p => p.id === editId.value);
      if (idx !== -1) {
        posts.value[idx] = { ...posts.value[idx], ...newPost.value };
      }
    } else {
      // Add new post
      posts.value.push({
        id: Date.now(),
        ...newPost.value,
      });
    }
    showModal.value = false;
  }
}

function flagPost(id) {
  const post = posts.value.find(p => p.id === id);
  if (post) post.flagged = true;
}

function unflagPost(id) {
  const post = posts.value.find(p => p.id === id);
  if (post) post.flagged = false;
}

function deletePost(id) {
  posts.value = posts.value.filter(p => p.id !== id);
}
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Post Management</h1>
    <div class="flex justify-end mb-2">
      <rs-button @click="openAddModal">
        <Icon name="material-symbols:add" class="mr-1" />
        Add Post
      </rs-button>
    </div>
    <div class="card p-4 mt-4">
      <rs-table
        :data="posts"
        :columns=" [
          { name: 'author', label: 'Author' },
          { name: 'title', label: 'Title' },
          { name: 'content', label: 'Content' },
          { name: 'date', label: 'Date' },
          { name: 'flagged', label: 'Flagged', slot: true },
          { name: 'action', label: 'Actions', slot: true }
        ]"
        :options="{ borderless: true }"
        advanced
      >
        <template #flagged="slotProps">
          <span v-if="slotProps.row && slotProps.row.flagged" class="text-red-500 font-bold">Flagged</span>
          <span v-else class="text-green-600">OK</span>
        </template>
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openEditModal(slotProps.row)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button
              size="sm"
              variant="danger"
              @click="deletePost(slotProps.row.id)"
            >
              <Icon name="material-symbols:delete-outline" />
            </rs-button>
            <rs-button
              size="sm"
              variant="warning"
              v-if="slotProps.row && !slotProps.row.flagged"
              @click="flagPost(slotProps.row.id)"
            >
              <Icon name="material-symbols:flag" />
            </rs-button>
            <rs-button
              size="sm"
              variant="success"
              v-if="slotProps.row && slotProps.row.flagged"
              @click="unflagPost(slotProps.row.id)"
            >
              <Icon name="material-symbols:flag-circle" />
            </rs-button>
          </div>
        </template>
      </rs-table>
    </div>
    <rs-modal
      :title="isEdit ? 'Edit Post' : 'Add Post'"
      ok-title="Save"
      cancel-title="Cancel"
      :ok-callback="savePost"
      v-model="showModal"
      :overlay-close="false"
    >
      <FormKit
        type="text"
        v-model="newPost.author"
        name="author"
        label="Author"
        :disabled="isEdit"
      />
      <FormKit
        type="text"
        v-model="newPost.title"
        name="title"
        label="Title"
      />
      <FormKit
        type="textarea"
        v-model="newPost.content"
        name="content"
        label="Content"
        rows="5"
      />
      <FormKit
        type="text"
        v-model="newPost.date"
        name="date"
        label="Date"
        disabled
      />
    </rs-modal>
  </div>
</template>