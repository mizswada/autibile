<script setup>
defineProps({
  compositeScores: {
    type: Array,
    default: () => [],
  },
  totalScore: {
    type: [Number, String],
    default: null,
  },
});

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return Number(num.toFixed(2)).toString();
}
</script>

<template>
  <div v-if="compositeScores?.length" class="mb-4">
    <h4 class="font-semibold text-gray-800 mb-2">Group scores</h4>
    <div class="space-y-2">
      <div
        v-for="(group, index) in compositeScores"
        :key="`${group.label}-${index}`"
        class="flex items-center justify-between p-3 rounded-lg bg-indigo-50 border border-indigo-100"
      >
        <div>
          <div class="font-medium text-indigo-900">{{ group.label }}</div>
          <div class="text-xs text-indigo-700 mt-0.5">
            Weighted average {{ formatNumber(group.average) }}
          </div>
        </div>
        <div class="text-xl font-bold text-indigo-700">{{ group.score }}</div>
      </div>
    </div>
    <p v-if="totalScore != null" class="text-sm text-gray-500 mt-2">
      Total score {{ totalScore }} combines these group scores with other
      question scores.
    </p>
  </div>
</template>
