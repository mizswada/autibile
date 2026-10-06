<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  middleware: 'auth',
  layout: 'default'
})

const config = ref({
  enabled: false,
  provider: 'openai',
  apiUrl: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  promptTemplate: '',
  timeoutMs: 15000
})

const defaultPromptTemplate = `You are a clinical screening assistant for autism spectrum disorder evaluations. Analyze the following questionnaire results and provide a brief interpretation.

Questionnaire: {{questionnaireName}}
Total Score: {{totalScore}} (Range: {{scoreMin}}-{{scoreMax}})
Rule-Based Interpretation: {{threshold}}

Answers Summary:
{{answers}}

Respond ONLY with valid JSON in this exact format:
{"result": "<short label like Good, Needs More Attention, Requires Evaluation>", "explanation": "<2-3 sentence explanation of contributing factors>"}`

const providerDefaults = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  local: 'http://localhost:11434/api/generate',
  custom: ''
}

const loading = ref(false)
const testLoading = ref(false)
const message = ref('')
const messageType = ref('') // 'success' or 'error'

// The settings stay read-only until an admin unlocks them with their own
// email and password (valid for 15 minutes, enforced by the server).
const locked = ref(true)
const showUnlockModal = ref(false)
const unlockEmail = ref('')
const unlockPassword = ref('')
const unlockError = ref('')
const unlocking = ref(false)
let relockTimer = null

function openUnlock() {
  unlockEmail.value = ''
  unlockPassword.value = ''
  unlockError.value = ''
  showUnlockModal.value = true
}

function closeUnlock() {
  if (unlocking.value) return
  showUnlockModal.value = false
  unlockPassword.value = ''
}

async function unlockSettings() {
  if (!unlockEmail.value.trim() || !unlockPassword.value) {
    unlockError.value = 'Enter your admin email and password.'
    return
  }
  unlocking.value = true
  unlockError.value = ''
  try {
    const res = await $fetch('/api/apps/settings/aiUnlock', {
      method: 'POST',
      body: { adminEmail: unlockEmail.value.trim(), adminPassword: unlockPassword.value }
    })
    if (res.statusCode === 200) {
      locked.value = false
      showUnlockModal.value = false
      const ms = (res.data?.expiresInSeconds || 900) * 1000
      clearTimeout(relockTimer)
      relockTimer = setTimeout(() => {
        locked.value = true
        message.value = 'The settings were locked again. Unlock to continue editing.'
        messageType.value = 'error'
      }, ms)
    } else {
      unlockError.value = res.message || 'Could not unlock.'
    }
  } catch (error) {
    unlockError.value = 'Could not unlock. Please try again.'
  }
  unlockPassword.value = ''
  unlocking.value = false
}

async function lockSettings() {
  clearTimeout(relockTimer)
  locked.value = true
  try {
    await $fetch('/api/apps/settings/aiLock', { method: 'POST' })
  } catch (error) {
    // The lock is also enforced by the server cookie expiring on its own.
  }
}

function relockIfServerSaysLocked(response) {
  if (response?.statusCode === 423) {
    clearTimeout(relockTimer)
    locked.value = true
  }
}

onBeforeUnmount(() => clearTimeout(relockTimer))

async function loadSettings() {
  loading.value = true
  try {
    const response = await $fetch('/api/apps/settings/aiConfig')
    if (response.statusCode === 200 && response.data) {
      config.value = {
        ...config.value,
        ...response.data
      }
    } else {
      message.value = response.message || 'Failed to load settings'
      messageType.value = 'error'
    }
  } catch (error) {
    message.value = 'Failed to load settings'
    messageType.value = 'error'
  }
  loading.value = false
}

async function saveSettings() {
  loading.value = true
  message.value = ''
  try {
    const response = await $fetch('/api/apps/settings/aiConfig', {
      method: 'POST',
      body: {
        enabled: config.value.enabled,
        provider: config.value.provider,
        apiUrl: config.value.apiUrl,
        apiKey: config.value.apiKey,
        model: config.value.model,
        promptTemplate: config.value.promptTemplate,
        timeoutMs: config.value.timeoutMs
      }
    })
    if (response.statusCode === 200) {
      message.value = 'Settings saved successfully. The settings are locked again.'
      messageType.value = 'success'
      await lockSettings()
      setTimeout(() => {
        message.value = ''
      }, 4000)
    } else {
      relockIfServerSaysLocked(response)
      message.value = response.message || 'Failed to save settings'
      messageType.value = 'error'
    }
  } catch (error) {
    message.value = 'Failed to save settings'
    messageType.value = 'error'
  }
  loading.value = false
}

async function testConnection() {
  testLoading.value = true
  message.value = ''
  try {
    const response = await $fetch('/api/apps/settings/aiTest', {
      method: 'POST',
      body: {}
    })
    if (response.statusCode === 200) {
      message.value = `Test successful: "${response.data.response.result}" - ${response.data.response.explanation}`
      messageType.value = 'success'
    } else {
      relockIfServerSaysLocked(response)
      message.value = response.message || 'Test failed'
      messageType.value = 'error'
    }
  } catch (error) {
    const fromApi = error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object'
      ? error.data.message
      : null
    const errorMsg = fromApi
      || (error instanceof Error ? error.message : 'Connection test failed')
    message.value = errorMsg
    messageType.value = 'error'
  }
  testLoading.value = false
}

function changeProvider() {
  const provider = config.value.provider
  if (provider === 'openai' || provider === 'anthropic' || provider === 'local' || provider === 'custom') {
    config.value.apiUrl = providerDefaults[provider]
  }
}

function resetPromptTemplate() {
  config.value.promptTemplate = defaultPromptTemplate
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">AI Analysis Settings</h1>
      <p class="text-gray-600">Configure AI provider for automated questionnaire analysis</p>
    </div>

    <div v-if="message" :class="[
      'p-4 rounded-lg mb-6',
      messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    ]">
      {{ message }}
    </div>

    <div v-if="locked" class="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-5">
      <p class="font-semibold text-yellow-900">These settings are locked</p>
      <p class="text-sm text-yellow-800 mt-1">
        Changing the AI settings affects the automated analysis of questionnaires for every user.
        Only authorised administrators should edit them. If you have permission, unlock them by
        entering your admin email and password.
      </p>
      <button
        type="button"
        class="mt-3 px-5 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
        @click="openUnlock"
      >
        Unlock to edit
      </button>
    </div>
    <div v-else class="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 flex items-center justify-between">
      <p class="text-sm text-green-800">Unlocked for editing. It locks again after saving, or after 15 minutes.</p>
      <button type="button" class="text-sm text-green-900 underline" @click="lockSettings">Lock now</button>
    </div>

    <form @submit.prevent="saveSettings" class="bg-white rounded-lg shadow-md p-8">
      <fieldset :disabled="locked" class="contents">
      <!-- Enable Toggle -->
      <div class="mb-6">
        <label class="flex items-center">
          <input
            v-model="config.enabled"
            type="checkbox"
            class="w-4 h-4 text-blue-600 rounded"
          />
          <span class="ml-3 text-gray-700 font-medium">Enable AI Analysis</span>
        </label>
      </div>

      <template v-if="config.enabled">
        <!-- Provider Select -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">AI Provider</label>
          <select
            v-model="config.provider"
            @change="changeProvider"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="local">Local (Ollama)</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <!-- API URL -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">API URL</label>
          <input
            v-model="config.apiUrl"
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://api.openai.com/v1/chat/completions"
          />
        </div>

        <!-- API Key -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">API Key</label>
          <input
            v-model="config.apiKey"
            type="password"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :placeholder="config.apiKey === '***SET***' ? 'Key already configured' : 'sk-...'"
          />
          <p class="text-xs text-gray-500 mt-1">Leave as "***SET***" to keep existing key</p>
        </div>

        <!-- Model -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">Model</label>
          <input
            v-model="config.model"
            type="text"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :placeholder="config.provider === 'custom' ? 'e.g. tencent/hy3-preview:free (OpenRouter)' : 'gpt-4o-mini'"
          />
          <p
            v-if="config.provider === 'custom' || (config.apiUrl && config.apiUrl.includes('openrouter'))"
            class="text-xs text-gray-500 mt-1"
          >
            For OpenRouter use the exact id from the model list (e.g. <code class="bg-gray-100 px-1 rounded">tencent/hy3-preview:free</code>).
            The <code class="bg-gray-100 px-1 rounded">:free</code> suffix is valid when the model offers a free route.
          </p>
        </div>

        <!-- Timeout -->
        <div class="mb-6">
          <label class="block text-gray-700 font-medium mb-2">Timeout (milliseconds)</label>
          <input
            v-model.number="config.timeoutMs"
            type="number"
            min="1000"
            max="60000"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <!-- Prompt Template -->
        <div class="mb-6">
          <div class="flex justify-between items-center mb-2">
            <label class="block text-gray-700 font-medium">Prompt Template</label>
            <button
              type="button"
              @click="resetPromptTemplate"
              class="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Reset to Default
            </button>
          </div>
          <textarea
            v-model="config.promptTemplate"
            rows="10"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Prompt template..."
          />
          <p class="text-xs text-gray-500 mt-1">Use {{questionnaireName}}, {{totalScore}}, {{scoreMin}}, {{scoreMax}}, {{threshold}}, {{answers}} placeholders</p>
        </div>
      </template>

      <!-- Buttons -->
      <div class="flex gap-4">
        <button
          type="submit"
          :disabled="loading"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Saving...' : 'Save Settings' }}
        </button>
        <button
          v-if="config.enabled"
          type="button"
          @click="testConnection"
          :disabled="testLoading"
          class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ testLoading ? 'Testing...' : 'Test Connection' }}
        </button>
      </div>
      </fieldset>
    </form>

    <!-- Unlock dialog -->
    <div v-if="showUnlockModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 class="text-xl font-bold mb-2">Unlock AI settings</h2>
        <p class="text-sm text-gray-600 mb-4">Enter your own administrator email and password to continue.</p>
        <label class="block text-sm text-gray-700 mb-1">Admin email</label>
        <input
          v-model="unlockEmail"
          type="email"
          autocomplete="off"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          @keyup.enter="unlockSettings"
        />
        <label class="block text-sm text-gray-700 mb-1">Admin password</label>
        <input
          v-model="unlockPassword"
          type="password"
          autocomplete="new-password"
          class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          @keyup.enter="unlockSettings"
        />
        <p v-if="unlockError" class="bg-red-100 text-red-800 text-sm rounded px-3 py-2 mb-3">{{ unlockError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-4 py-2 border border-gray-300 rounded-lg" :disabled="unlocking" @click="closeUnlock">Cancel</button>
          <button
            type="button"
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
            :disabled="unlocking"
            @click="unlockSettings"
          >
            {{ unlocking ? 'Checking...' : 'Unlock' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input:disabled,
select:disabled,
textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
