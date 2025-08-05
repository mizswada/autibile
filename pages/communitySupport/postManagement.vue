<script setup>
import { ref, onMounted } from 'vue'
import { useFetch } from '#app'

const posts = ref([])
const showModal = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const error = ref('')
const success = ref('')
const newPost = ref({
  author: '',
  title: '',
  content: '',
  url: '',
})

const showDeleteConfirm = ref(false)
const postToDelete = ref(null)
const deleteMessage = ref('')

const columns = [
  { name: 'no', label: 'No.' },
  { name: 'author', label: 'Author' },
  { name: 'title', label: 'Title' },
  { name: 'content', label: 'Content' },
  { name: 'url', label: 'URL' },
  { name: 'action', label: 'Actions', slot: true }
]

async function fetchPosts() {
  try {
    const { data, error: fetchError } = await useFetch('/api/communitySupport/list')
    if (data.value) {
      posts.value = data.value.map(post => ({
        no: post.no,
        id: post.id, // Keep ID for internal use but don't display it
        author: post.author,
        title: post.title,
        content: post.content || '',
        url: post.url || '',
        action: "edit",
      }))
    }
  } catch (e) {
    error.value = 'Failed to load posts'
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
    url: '',
  }
  isEdit.value = false
  editId.value = null
  showModal.value = true
}

async function savePost() {
  error.value = ''
  success.value = ''
  
  if (newPost.value.title.trim() && newPost.value.content.trim()) {
    try {
      if (isEdit.value && editId.value !== null) {
        // Edit post
        const response = await $fetch('/api/communitySupport/update', {
          method: 'PUT',
          query: { id: editId.value },
          body: {
            community_author: newPost.value.author,
            community_title: newPost.value.title,
            community_content: newPost.value.content,
            community_url: newPost.value.url,
          },
        })
        
        if (response.statusCode === 200) {
          success.value = 'Post updated successfully!'
          showModal.value = false
          await fetchPosts()
          clearMessages()
        } else {
          error.value = response.message || 'Failed to update post'
          clearMessages()
        }
      } else {
        // Add new post
        const response = await $fetch('/api/communitySupport/add', {
          method: 'POST',
          body: {
            community_author: newPost.value.author,
            community_title: newPost.value.title,
            community_content: newPost.value.content,
            community_url: newPost.value.url,
          },
        })
        
        if (response.statusCode === 200) {
          success.value = 'Post added successfully!'
          showModal.value = false
          await fetchPosts()
          clearMessages()
        } else {
          error.value = response.message || 'Failed to add post'
          clearMessages()
        }
      }
    } catch (e) {
      error.value = e.data?.message || e.message || 'Failed to save post'
      console.error(e)
      clearMessages()
    }
  } else {
    error.value = 'Please fill in all required fields'
    clearMessages()
  }
}

function confirmDelete(post) {
  postToDelete.value = post
  deleteMessage.value = `Are you sure you want to delete the post titled "${post.title}"?`
  showDeleteConfirm.value = true
}

async function deletePost() {
  if (!postToDelete.value) return
  
  error.value = ''
  success.value = ''
  
  try {
    const response = await $fetch('/api/communitySupport/delete', {
      method: 'DELETE',
      query: { id: postToDelete.value.id },
    })
    
    if (response.statusCode === 200) {
      success.value = 'Post deleted successfully!'
      showDeleteConfirm.value = false
      postToDelete.value = null
      await fetchPosts()
      clearMessages()
    } else {
      error.value = response.message || 'Failed to delete post'
      clearMessages()
    }
  } catch (e) {
    error.value = 'Failed to delete post'
    console.error(e)
    clearMessages()
  }
}

// Clear messages after a few seconds
function clearMessages() {
  setTimeout(() => {
    error.value = ''
    success.value = ''
  }, 5000)
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
    
    <!-- Success Message -->
    <div v-if="success" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
      {{ success }}
    </div>
    
    <!-- Error Message -->
    <div v-if="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {{ error }}
    </div>
    
    <div class="card p-4 mt-4 overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-gray-50">
            <th class="px-4 py-2 text-left border-b">No.</th>
            <th class="px-4 py-2 text-left border-b">Author</th>
            <th class="px-4 py-2 text-left border-b">Title</th>
            <th class="px-4 py-2 text-left border-b">Content</th>
            <th class="px-4 py-2 text-left border-b">URL</th>
            <th class="px-4 py-2 text-left border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id" class="hover:bg-gray-50">
            <td class="px-4 py-2 border-b">{{ post.no }}</td>
            <td class="px-4 py-2 border-b">{{ post.author }}</td>
            <td class="px-4 py-2 border-b">{{ post.title }}</td>
            <td class="px-4 py-2 border-b">
              <div class="max-w-xs truncate" :title="post.content">
                {{ post.content }}
              </div>
            </td>
            <td class="px-4 py-2 border-b">
              <div class="max-w-xs truncate" :title="post.url">
                {{ post.url || 'No URL' }}
              </div>
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex gap-2">
                <rs-button size="sm" @click="openEditModal(post)">
                  <Icon name="material-symbols:edit-outline-rounded" />
                </rs-button>
                <rs-button
                  size="sm"
                  variant="danger"
                  @click="confirmDelete(post)"
                >
                  <Icon name="material-symbols:delete-outline" />
                </rs-button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
        rows="8"
        class="min-h-[200px]"
      />
      <FormKit
        type="url"
        v-model="newPost.url"
        name="url"
        label="URL"
        placeholder="https://example.com"
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