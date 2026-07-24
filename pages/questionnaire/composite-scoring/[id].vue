<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const questionnaireId = route.params.id;

const questionnaire = ref(null);
const questions = ref([]);
const groups = ref([]);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

onMounted(async () => {
  await Promise.all([fetchQuestionnaireData(), fetchQuestions()]);
  await fetchConfig();
  isLoading.value = false;
});

async function fetchQuestionnaireData() {
  try {
    const res = await fetch(`/api/questionnaire/listQuestionnaires?questionnaireID=${questionnaireId}`);
    const result = await res.json();
    if (res.ok && result.data && result.data.length > 0) {
      questionnaire.value = result.data[0];
    } else {
      errorMessage.value = 'Autism screening not found';
    }
  } catch (err) {
    console.error('Error loading autism screening:', err);
    errorMessage.value = 'Error loading autism screening';
  }
}

async function fetchQuestions() {
  try {
    const res = await fetch(`/api/questionnaire/questions/listQuestions?questionnaireID=${questionnaireId}`);
    const result = await res.json();
    if (res.ok && result.data) {
      questions.value = result.data;
    }
  } catch (err) {
    console.error('Error loading questions:', err);
  }
}

async function fetchConfig() {
  try {
    const res = await fetch(`/api/questionnaire/compositeScoring?questionnaireId=${questionnaireId}`);
    const result = await res.json();
    if (res.ok && result.data && Array.isArray(result.data.composite_groups)) {
      groups.value = result.data.composite_groups.map(normalizeIncomingGroup);
    }
  } catch (err) {
    console.error('Error loading composite scoring config:', err);
  }
}

function normalizeIncomingGroup(group) {
  return {
    label: group.label ?? '',
    divisor: group.divisor ?? 7,
    exclude_members_from_raw_sum: group.exclude_members_from_raw_sum !== false,
    members: Array.isArray(group.members) && group.members.length > 0
      ? group.members.map((m) => ({ question_id: m.question_id ?? '', weight: m.weight ?? 1 }))
      : [{ question_id: '', weight: 1 }],
    bands: Array.isArray(group.bands) && group.bands.length > 0
      ? group.bands.map((b) => ({ upTo: b.upTo ?? '', score: b.score ?? 0 }))
      : [{ upTo: '', score: 0 }],
    preview: {},
  };
}

function questionLabel(question) {
  const text = question.question_text_bi || question.question_text_bm || `Question ${question.question_id}`;
  const order = question.order != null ? `Q${question.order}. ` : '';
  return `${order}${text}`;
}

function addGroup() {
  groups.value.push({
    label: '',
    divisor: 7,
    exclude_members_from_raw_sum: true,
    members: [{ question_id: '', weight: 1 }],
    bands: [
      { upTo: '', score: 0 },
    ],
    preview: {},
  });
}

function removeGroup(index) {
  if (!confirm('Remove this scoring group?')) return;
  groups.value.splice(index, 1);
}

function addMember(group) {
  group.members.push({ question_id: '', weight: 1 });
}

function removeMember(group, index) {
  group.members.splice(index, 1);
}

function addBand(group) {
  group.bands.push({ upTo: '', score: 0 });
}

function removeBand(group, index) {
  group.bands.splice(index, 1);
}

// --- Live preview (mirrors server-side band logic) ---
function mapAverageToBandScore(average, bands) {
  const sorted = [...bands]
    .filter((b) => b.score !== '' && b.score !== null && b.score !== undefined)
    .map((b) => ({
      upTo: b.upTo === '' || b.upTo === null || b.upTo === undefined ? Infinity : Number(b.upTo),
      score: Number(b.score),
    }))
    .sort((a, b) => a.upTo - b.upTo);

  if (sorted.length === 0) return null;

  for (const band of sorted) {
    if (average < band.upTo) return band.score;
  }
  return sorted[sorted.length - 1].score;
}

function previewFor(group) {
  const divisor = Number(group.divisor);
  if (!Number.isFinite(divisor) || divisor <= 0) {
    return { valid: false };
  }

  let weightedSum = 0;
  for (const member of group.members) {
    const value = Number(group.preview?.[member.question_id]) || 0;
    const weight = Number(member.weight) || 0;
    weightedSum += value * weight;
  }

  const average = weightedSum / divisor;
  const score = mapAverageToBandScore(average, group.bands);

  return {
    valid: true,
    weightedSum: Math.round(weightedSum * 100) / 100,
    average: Math.round(average * 100) / 100,
    score,
  };
}

const usedQuestionIds = computed(() => {
  const ids = new Set();
  for (const group of groups.value) {
    for (const member of group.members) {
      if (member.question_id !== '' && member.question_id !== null) {
        ids.add(Number(member.question_id));
      }
    }
  }
  return ids;
});

function buildPayloadGroups() {
  return groups.value.map((group) => ({
    label: group.label?.trim() || 'Composite score',
    divisor: Number(group.divisor),
    exclude_members_from_raw_sum: group.exclude_members_from_raw_sum !== false,
    members: group.members
      .filter((m) => m.question_id !== '' && m.question_id !== null)
      .map((m) => ({ question_id: Number(m.question_id), weight: Number(m.weight) })),
    bands: group.bands
      .filter((b) => b.score !== '' && b.score !== null && b.score !== undefined)
      .map((b) => ({
        upTo: b.upTo === '' || b.upTo === null || b.upTo === undefined ? null : Number(b.upTo),
        score: Number(b.score),
      })),
  }));
}

function validateBeforeSave(payloadGroups) {
  for (let i = 0; i < payloadGroups.length; i++) {
    const g = payloadGroups[i];
    const label = `Group ${i + 1}`;
    if (g.members.length === 0) {
      return `${label}: select at least one question`;
    }
    if (!Number.isFinite(g.divisor) || g.divisor <= 0) {
      return `${label}: divisor must be greater than 0`;
    }
    if (g.bands.length === 0) {
      return `${label}: add at least one score band`;
    }
    for (const m of g.members) {
      if (!Number.isFinite(m.weight)) {
        return `${label}: every question needs a numeric weight`;
      }
    }
  }
  return null;
}

async function saveConfig() {
  errorMessage.value = '';
  successMessage.value = '';

  const payloadGroups = buildPayloadGroups();
  const validationError = validateBeforeSave(payloadGroups);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  isSaving.value = true;
  try {
    const res = await fetch('/api/questionnaire/compositeScoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionnaire_id: parseInt(questionnaireId),
        composite_scoring_config:
          payloadGroups.length > 0 ? { composite_groups: payloadGroups } : null,
      }),
    });
    const result = await res.json();
    if (res.ok) {
      successMessage.value = 'Composite scoring configuration saved successfully';
      setTimeout(() => (successMessage.value = ''), 3000);
    } else {
      errorMessage.value = result.message || 'Failed to save configuration';
    }
  } catch (err) {
    console.error('Error saving config:', err);
    errorMessage.value = 'An unexpected error occurred';
  } finally {
    isSaving.value = false;
  }
}

function goBack() {
  router.push('/questionnaire');
}
</script>

<template>
  <div>
    <div class="flex items-center mb-4">
      <button @click="goBack" class="mr-2 p-2 rounded hover:bg-gray-100" title="Go Back">
        <Icon name="material-symbols:arrow-back" />
      </button>
      <h1 class="text-2xl font-bold">Composite Scoring Configuration</h1>
    </div>

    <div v-if="successMessage" class="mb-4 p-3 rounded bg-green-100 text-green-700 border border-green-300">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="flex justify-center my-8">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="questionnaire">
      <div class="card mb-6 p-4">
        <h2 class="text-xl font-semibold">{{ questionnaire.title }}</h2>
        <p class="text-sm text-gray-500">{{ questionnaire.description }}</p>
      </div>

      <div class="card p-4 mb-6 bg-blue-50 border border-blue-200">
        <h3 class="font-semibold mb-2">How composite scoring works</h3>
        <p class="text-sm text-gray-600 mb-2">
          A scoring group combines several questions into a single score. Each answer is
          multiplied by its weight, the results are added together and divided by the divisor
          to get an average. The average is then matched to a band to produce the group's score,
          which is added to the questionnaire total.
        </p>
        <p class="text-sm text-gray-600">
          Example (Screen Time): weights 5, 5, 2, 2 with divisor 7 gives
          <em>(Q1×5 + Q2×5 + Q3×2 + Q4×2) ÷ 7</em>. Bands then map the average to 0, 1 or 2.
        </p>
      </div>

      <div
        v-for="(group, gIndex) in groups"
        :key="gIndex"
        class="card p-4 mb-6 border border-gray-200"
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Scoring Group {{ gIndex + 1 }}</h3>
          <button
            @click="removeGroup(gIndex)"
            class="text-red-600 hover:text-red-900"
            title="Remove group"
          >
            <Icon name="material-symbols:delete-outline" size="22" />
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Group label</label>
            <input
              v-model="group.label"
              type="text"
              placeholder="e.g. Screen Time (SEQ)"
              class="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Divisor</label>
            <input
              v-model="group.divisor"
              type="number"
              min="0.0001"
              step="any"
              class="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>

        <!-- Members -->
        <div class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-medium">Questions &amp; weights</h4>
            <rs-button variant="primary" @click="addMember(group)">
              <Icon name="material-symbols:add" class="mr-1" /> Add question
            </rs-button>
          </div>
          <div
            v-for="(member, mIndex) in group.members"
            :key="mIndex"
            class="flex gap-2 items-center mb-2"
          >
            <select
              v-model="member.question_id"
              class="flex-1 border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Select a question…</option>
              <option
                v-for="q in questions"
                :key="q.question_id"
                :value="q.question_id"
              >
                {{ questionLabel(q) }}
              </option>
            </select>
            <input
              v-model="member.weight"
              type="number"
              step="any"
              placeholder="Weight"
              class="w-28 border border-gray-300 rounded px-3 py-2"
            />
            <button
              @click="removeMember(group, mIndex)"
              class="text-red-500 hover:text-red-700 p-2"
              title="Remove question"
            >
              <Icon name="material-symbols:close" size="20" />
            </button>
          </div>
        </div>

        <!-- Bands -->
        <div class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-medium">Score bands</h4>
            <rs-button variant="primary" @click="addBand(group)">
              <Icon name="material-symbols:add" class="mr-1" /> Add band
            </rs-button>
          </div>
          <p class="text-xs text-gray-500 mb-2">
            A band applies when the average is below its "up to" value. Leave "up to" empty for
            the highest band (catch-all). Bands are evaluated from lowest to highest automatically.
          </p>
          <div
            v-for="(band, bIndex) in group.bands"
            :key="bIndex"
            class="flex gap-2 items-center mb-2"
          >
            <span class="text-sm text-gray-600 w-24">Average &lt;</span>
            <input
              v-model="band.upTo"
              type="number"
              step="any"
              placeholder="up to (empty = ∞)"
              class="w-40 border border-gray-300 rounded px-3 py-2"
            />
            <span class="text-sm text-gray-600">→ score</span>
            <input
              v-model="band.score"
              type="number"
              step="any"
              placeholder="score"
              class="w-28 border border-gray-300 rounded px-3 py-2"
            />
            <button
              @click="removeBand(group, bIndex)"
              class="text-red-500 hover:text-red-700 p-2"
              title="Remove band"
            >
              <Icon name="material-symbols:close" size="20" />
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" v-model="group.exclude_members_from_raw_sum" />
            Exclude these questions' raw values from the total (recommended, avoids double-counting)
          </label>
        </div>

        <!-- Live preview -->
        <div class="bg-gray-50 border border-gray-200 rounded p-3">
          <h4 class="font-medium mb-2">Live preview</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div
              v-for="member in group.members.filter((m) => m.question_id !== '')"
              :key="member.question_id"
              class="flex items-center gap-2"
            >
              <span class="text-sm text-gray-600 flex-1 truncate">
                {{ questionLabel(questions.find((q) => q.question_id === Number(member.question_id)) || {}) }}
              </span>
              <input
                v-model="group.preview[member.question_id]"
                type="number"
                step="any"
                placeholder="value"
                class="w-24 border border-gray-300 rounded px-2 py-1"
              />
            </div>
          </div>
          <div class="text-sm text-gray-700">
            <template v-if="previewFor(group).valid">
              Weighted sum: <strong>{{ previewFor(group).weightedSum }}</strong> ·
              Average: <strong>{{ previewFor(group).average }}</strong> ·
              Group score:
              <strong>{{ previewFor(group).score === null ? '—' : previewFor(group).score }}</strong>
            </template>
            <template v-else>
              Enter a valid divisor to preview the score.
            </template>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mb-8">
        <rs-button variant="primary-outline" @click="addGroup">
          <Icon name="material-symbols:add" class="mr-1" /> Add scoring group
        </rs-button>
        <rs-button :disabled="isSaving" @click="saveConfig">
          <Icon name="material-symbols:save-outline" class="mr-1" />
          {{ isSaving ? 'Saving…' : 'Save configuration' }}
        </rs-button>
      </div>

      <div v-if="groups.length === 0" class="text-center py-8 text-gray-500">
        No composite scoring configured. This questionnaire uses normal (sum) scoring.
        Add a scoring group to enable weighted/averaged scoring.
      </div>
    </div>

    <div v-else class="text-center py-12">
      <div class="flex flex-col items-center">
        <Icon name="material-symbols:error-outline" size="64" class="text-gray-400 mb-4" />
        <h3 class="text-xl font-medium text-gray-600 mb-2">Autism Screening Not Found</h3>
        <p class="text-gray-500">The requested autism screening could not be found.</p>
      </div>
    </div>
  </div>
</template>
