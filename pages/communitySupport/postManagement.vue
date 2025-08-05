<script setup>
import { ref, onMounted } from 'vue'
import { useFetch } from '#app'

const posts = ref([])
const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const newPost = ref({
  author: '',
  title: '',
  content: '',
})

const showDeleteConfirm = ref(false)
const postToDelete = ref(null)
const deleteMessage = ref('')

const columns = [
  { name: 'no', label: 'No.' },
  { name: 'id',     label: 'ID',     hidden: true },
  { name: 'author', label: 'Author' },
  { name: 'title', label: 'Title' },
  { name: 'content', label: 'Content' },
  { name: 'action', label: 'Actions', slot: true }
]

async function fetchPosts() {
  const { data, error } = await useFetch('/api/communitySupport/list')
  if (data.value) {
    posts.value = data.value.map(post => ({
      no: post.no,
      author: post.author,
      title: post.title,
      content: post.content,
      action: "edit",
    }))
  }
}

onMounted(fetchPosts)

function openEditModal(post) {
  newPost.value = { ...post }
  isEdit.value = true
  editId.value = post.id
  showModal.value = true
}

function openAddModal() {
  newPost.value = {
    author: '',
    title: '',
    content: '',
  }
  isEdit.value = false
  editId.value = null
  showModal.value = true
}

async function savePost() {
  if (newPost.value.title.trim() && newPost.value.content.trim()) {
    if (isEdit.value && editId.value !== null) {
      // Edit post
      await $fetch('/api/communitySupport/update', {
        method: 'PUT',
        query: { id: editId.value },
        body: {
          community_author: newPost.value.author,
          community_title: newPost.value.title,
          community_content: newPost.value.content,
        },
      })
    } else {
      // Add new post
      await $fetch('/api/communitySupport/add', {
        method: 'POST',
        body: {
          community_author: newPost.value.author,
          community_title: newPost.value.title,
          community_content: newPost.value.content,
        },
      })
    }
    showModal.value = false
    await fetchPosts()
  }
}

function confirmDelete(post) {
  postToDelete.value = post
  deleteMessage.value = `Are you sure you want to delete the post titled "${post.title}"?`
  showDeleteConfirm.value = true
}

async function deletePost() {
  if (!postToDelete.value) return
  await $fetch('/api/communitySupport/delete', {
    method: 'DELETE',
    query: { id: postToDelete.value.id },
  })
  showDeleteConfirm.value = false
  postToDelete.value = null
  await fetchPosts()
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
        :columns="columns"
        :options="{ borderless: true }"
        advanced
      >
        <template #action="slotProps">
          <div class="flex gap-2">
            <rs-button size="sm" @click="openEditModal(slotProps.value)">
              <Icon name="material-symbols:edit-outline-rounded" />
            </rs-button>
            <rs-button
              size="sm"
              variant="danger"
              @click="confirmDelete(slotProps.value)"
            >
              <Icon name="material-symbols:delete-outline" />
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
    </rs-modal>
    <rs-modal
      title="Delete Confirmation"
      ok-title="Delete"
      cancel-title="Cancel"
      :ok-callback="deletePost"
      v-model="showDeleteConfirm"
      :overlay-close="false"
    >
      <p>{{ deleteMessage }}</p>
    </rs-modal>
  </div>
</template>