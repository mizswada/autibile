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

function convertLegacyUpToBands(bands) {
  const sorted = [...bands].sort((a, b) => {
    const aUp =
      a.upTo === '' || a.upTo === null || a.upTo === undefined
        ? Infinity
        : Number(a.upTo);
    const bUp =
      b.upTo === '' || b.upTo === null || b.upTo === undefined
        ? Infinity
        : Number(b.upTo);
    return aUp - bUp;
  });

  let previousBound = 0;
  return sorted.map((band) => {
    const hasMax =
      band.upTo !== '' && band.upTo !== null && band.upTo !== undefined;
    const max = hasMax ? Number(band.upTo) : '';
    const converted = {
      min: previousBound,
      max,
      score: band.score ?? 0,
    };
    if (hasMax) previousBound = Number(band.upTo);
    return converted;
  });
}

function normalizeIncomingBands(bands) {
  if (!Array.isArray(bands) || bands.length === 0) {
    return [
      { min: 0, max: 1, score: 0 },
      { min: 1, max: 2, score: 1 },
      { min: 2, max: '', score: 2 },
    ];
  }

  const hasMinMax = bands.some(
    (b) =>
      Object.prototype.hasOwnProperty.call(b || {}, 'min') ||
      Object.prototype.hasOwnProperty.call(b || {}, 'max'),
  );

  if (hasMinMax) {
    return bands.map((b) => ({
      min: b.min ?? 0,
      max: b.max === null || b.max === undefined ? '' : b.max,
      score: b.score ?? 0,
    }));
  }

  // Legacy Average < upTo bands → min/max ranges
  return convertLegacyUpToBands(bands);
}

function normalizeIncomingGroup(group) {
  return {
    label: group.label ?? '',
    divisor: group.divisor ?? 7,
    exclude_members_from_raw_sum: group.exclude_members_from_raw_sum !== false,
    members: Array.isArray(group.members) && group.members.length > 0
      ? group.members.map((m) => ({ question_id: m.question_id ?? '', weight: m.weight ?? 1 }))
      : [{ question_id: '', weight: 1 }],
    bands: normalizeIncomingBands(group.bands),
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
      { min: 0, max: 1, score: 0 },
      { min: 1, max: 2, score: 1 },
      { min: 2, max: '', score: 2 },
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
  const last = group.bands[group.bands.length - 1];
  const nextMin =
    last && last.max !== '' && last.max !== null && last.max !== undefined
      ? Number(last.max)
      : last
        ? Number(last.min) || 0
        : 0;

  group.bands.push({ min: nextMin, max: '', score: 0 });
}

function formatBandRange(band) {
  const min = band.min === '' || band.min === null || band.min === undefined
    ? 0
    : Number(band.min);
  const hasMax =
    band.max !== '' && band.max !== null && band.max !== undefined;

  if (!hasMax) {
    return `Average ≥ ${min}`;
  }

  const max = Number(band.max);
  if (min === max) {
    return `Average = ${min}`;
  }
  if (min === 0) {
    return `Average ≤ ${max}`;
  }
  return `${min} - ${max}`;
}

function removeBand(group, index) {
  group.bands.splice(index, 1);
}

// --- Live preview (mirrors server-side inclusive min/max band logic) ---
function mapAverageToBandScore(average, bands) {
  const sorted = [...bands]
    .filter((b) => b.score !== '' && b.score !== null && b.score !== undefined)
    .map((b) => ({
      min:
        b.min === '' || b.min === null || b.min === undefined
          ? 0
          : Number(b.min),
      max:
        b.max === '' || b.max === null || b.max === undefined
          ? null
          : Number(b.max),
      score: Number(b.score),
    }))
    .sort((a, b) => a.min - b.min);

  if (sorted.length === 0) return null;

  for (const band of sorted) {
    const withinMin = average >= band.min;
    const withinMax = band.max === null || average <= band.max;
    if (withinMin && withinMax) return band.score;
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
        min:
          b.min === '' || b.min === null || b.min === undefined
            ? 0
            : Number(b.min),
        max:
          b.max === '' || b.max === null || b.max === undefined
            ? null
            : Number(b.max),
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
    for (const band of g.bands) {
      if (!Number.isFinite(band.min)) {
        return `${label}: each band needs a numeric minimum`;
      }
      if (band.max !== null && !Number.isFinite(band.max)) {
        return `${label}: each band maximum must be a number`;
      }
      if (band.max !== null && band.max < band.min) {
        return `${label}: band maximum must be ≥ minimum`;
      }
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
          <em>(Q1×5 + Q2×5 + Q3×2 + Q4×2) ÷ 7</em>. Score bands then map that average
          by range (e.g. 0–1 → 0, 1–2 → 1, 2+ → 2), like scoring thresholds.
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
          <p class="text-xs text-gray-500 mb-3">
            Same idea as scoring thresholds: each band covers an average range
            (minimum to maximum, inclusive). Leave maximum empty for no upper limit.
            The first matching band (lowest minimum) wins.
          </p>

          <div class="overflow-x-auto border border-gray-200 rounded">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Average range
                  </th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Minimum
                  </th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Maximum
                  </th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Score
                  </th>
                  <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(band, bIndex) in group.bands" :key="bIndex">
                  <td class="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">
                    {{ formatBandRange(band) }}
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="band.min"
                      type="number"
                      step="any"
                      placeholder="Min"
                      class="w-28 border border-gray-300 rounded px-3 py-2"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="band.max"
                      type="number"
                      step="any"
                      placeholder="No upper limit"
                      class="w-36 border border-gray-300 rounded px-3 py-2"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="band.score"
                      type="number"
                      step="any"
                      placeholder="Score"
                      class="w-28 border border-gray-300 rounded px-3 py-2"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button
                      @click="removeBand(group, bIndex)"
                      class="text-red-500 hover:text-red-700 p-2"
                      title="Remove band"
                    >
                      <Icon name="material-symbols:close" size="20" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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
