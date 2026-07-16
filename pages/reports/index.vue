<script setup>
import { ref, computed, watch, onMounted } from "vue";
import {
  getReportEntities,
  getReportDefinition,
  getColumnLabel,
} from "~/utils/reportDefinitions";

definePageMeta({
  title: "Reports",
});

const entityOptions = getReportEntities();
const entity = ref("appointments");
const def = computed(() => getReportDefinition(entity.value));

const optionsData = ref({
  patients: [],
  practitioners: [],
  services: [],
  centers: [],
});

const filterValues = ref({});
const selectedColumns = ref([]);
const groupBy = ref("");
const sortKey = ref("");
const sortDir = ref("asc");

const previewFields = ref([]);
const previewRows = ref([]);
const previewTotal = ref(0);
const previewShown = ref(0);
const previewLoading = ref(false);
const downloading = ref(false);
const message = ref("");
const messageType = ref("info");

function showMessage(text, type = "info") {
  message.value = text;
  messageType.value = type;
  if (type !== "error") {
    setTimeout(() => {
      message.value = "";
    }, 4000);
  }
}

function initForEntity() {
  const d = def.value;
  const fv = {};
  for (const filter of d.filters) {
    if (filter.type === "dateRange") fv[filter.key] = { start: "", end: "" };
    else if (filter.type === "multiselect") fv[filter.key] = [];
    else fv[filter.key] = "";
  }
  filterValues.value = fv;
  selectedColumns.value = [...d.defaultColumns];
  groupBy.value = "";
  sortKey.value = d.defaultSort.key;
  sortDir.value = d.defaultSort.dir;
  previewFields.value = [];
  previewRows.value = [];
  previewTotal.value = 0;
  previewShown.value = 0;
}

watch(entity, initForEntity);

// Initialize synchronously so filterValues is populated for the first render
// (SSR + initial client render happen before onMounted).
initForEntity();

const columnOptions = computed(() =>
  def.value.columns.map((c) => ({ label: c.label, value: c.key })),
);

const groupByOptions = computed(() => [
  { label: "None", value: "" },
  ...def.value.groupableKeys.map((k) => ({
    label: getColumnLabel(def.value, k),
    value: k,
  })),
]);

const sortFieldOptions = computed(() =>
  def.value.sortableKeys.map((k) => ({
    label: getColumnLabel(def.value, k),
    value: k,
  })),
);

function filterSelectOptions(filter) {
  const base = [{ label: "All", value: "" }];
  if (filter.optionsSource) {
    return base.concat(optionsData.value[filter.optionsSource] || []);
  }
  return base.concat(filter.options || []);
}

function buildFilters() {
  const out = {};
  for (const filter of def.value.filters) {
    const val = filterValues.value[filter.key];
    if (filter.type === "dateRange") {
      if (val?.start || val?.end) out[filter.key] = { start: val.start, end: val.end };
    } else if (filter.type === "multiselect") {
      if (Array.isArray(val) && val.length) out[filter.key] = val;
    } else if (val !== "" && val !== null && val !== undefined) {
      out[filter.key] = val;
    }
  }
  return out;
}

function labelForOption(filter, value) {
  const list = filter.optionsSource
    ? optionsData.value[filter.optionsSource] || []
    : filter.options || [];
  const found = list.find((o) => String(o.value) === String(value));
  return found ? found.label : value;
}

function buildFilterSummary() {
  const parts = [];
  for (const filter of def.value.filters) {
    const val = filterValues.value[filter.key];
    if (filter.type === "dateRange") {
      if (val?.start || val?.end) {
        parts.push(`${filter.label}: ${val.start || "…"} to ${val.end || "…"}`);
      }
    } else if (filter.type === "multiselect") {
      if (Array.isArray(val) && val.length) {
        parts.push(
          `${filter.label}: ${val.map((v) => labelForOption(filter, v)).join(", ")}`,
        );
      }
    } else if (val !== "" && val !== null && val !== undefined) {
      parts.push(`${filter.label}: ${labelForOption(filter, val)}`);
    }
  }
  return parts.join("; ");
}

function buildConfig() {
  return {
    entity: entity.value,
    columns: selectedColumns.value,
    filters: buildFilters(),
    groupBy: groupBy.value || null,
    sort: { key: sortKey.value, dir: sortDir.value },
    filterSummary: buildFilterSummary(),
  };
}

async function loadOptions() {
  try {
    const res = await $fetch("/api/reports/options");
    if (res?.success) optionsData.value = res.data;
  } catch (e) {
    console.error("Failed to load report options", e);
  }
}

async function generatePreview() {
  if (!selectedColumns.value.length) {
    showMessage("Please select at least one column.", "error");
    return;
  }
  previewLoading.value = true;
  message.value = "";
  try {
    const res = await $fetch("/api/reports/preview", {
      method: "POST",
      body: buildConfig(),
    });
    if (res?.success) {
      previewFields.value = res.data.fields;
      previewRows.value = res.data.rows;
      previewTotal.value = res.data.total;
      previewShown.value = res.data.shown;
      if (res.data.total === 0) showMessage("No records match the filters.", "info");
    } else {
      showMessage(res?.message || "Failed to generate preview.", "error");
    }
  } catch (e) {
    showMessage(e?.data?.message || "Failed to generate preview.", "error");
  } finally {
    previewLoading.value = false;
  }
}

async function downloadExcel() {
  if (!selectedColumns.value.length) {
    showMessage("Please select at least one column.", "error");
    return;
  }
  downloading.value = true;
  message.value = "";
  try {
    const blob = await $fetch("/api/reports/export", {
      method: "POST",
      body: buildConfig(),
      responseType: "blob",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${def.value.label.replace(/\s+/g, "_")}_Report_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage("Report downloaded.", "success");
  } catch (e) {
    showMessage(e?.data?.message || "Failed to export report.", "error");
  } finally {
    downloading.value = false;
  }
}

onMounted(() => {
  loadOptions();
});
</script>

<template>
  <div class="mb-4">
    <h1 class="text-2xl font-bold">Reports</h1>
    <p class="text-gray-500 mt-1">
      Build and download a formatted Excel report. Choose a report type, apply
      filters, pick columns, then group and sort as needed.
    </p>

    <!-- Configuration -->
    <div class="card p-4 mt-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Report type -->
        <FormKit
          type="select"
          label="Report Type"
          v-model="entity"
          :options="entityOptions"
          outer-class="mb-0"
        />

        <!-- Group by -->
        <FormKit
          type="select"
          label="Group By"
          v-model="groupBy"
          :options="groupByOptions"
          outer-class="mb-0"
        />

        <!-- Sort -->
        <div class="flex gap-2">
          <FormKit
            type="select"
            label="Sort By"
            v-model="sortKey"
            :options="sortFieldOptions"
            outer-class="mb-0 flex-1"
          />
          <FormKit
            type="select"
            label="Order"
            v-model="sortDir"
            :options="[
              { label: 'Asc', value: 'asc' },
              { label: 'Desc', value: 'desc' },
            ]"
            outer-class="mb-0 w-28"
          />
        </div>
      </div>

      <!-- Filters -->
      <div class="mt-6">
        <h3 class="font-semibold mb-3">Filters</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <template v-for="filter in def.filters" :key="filter.key">
            <!-- Date range -->
            <div v-if="filter.type === 'dateRange'" class="flex gap-2">
              <FormKit
                type="date"
                :label="`${filter.label} (From)`"
                v-model="filterValues[filter.key].start"
                outer-class="mb-0 flex-1"
              />
              <FormKit
                type="date"
                :label="`${filter.label} (To)`"
                v-model="filterValues[filter.key].end"
                outer-class="mb-0 flex-1"
              />
            </div>

            <!-- Multi-select (checkbox group) -->
            <div v-else-if="filter.type === 'multiselect'">
              <label class="block text-sm font-medium mb-1">{{ filter.label }}</label>
              <div
                class="border border-gray-200 rounded-md p-2 max-h-32 overflow-y-auto bg-[rgb(var(--bg-1))]"
              >
                <FormKit
                  type="checkbox"
                  :options="filter.options"
                  v-model="filterValues[filter.key]"
                  outer-class="mb-0"
                  :classes="{ options: 'space-y-1' }"
                />
              </div>
            </div>

            <!-- Single select -->
            <FormKit
              v-else
              type="select"
              :label="filter.label"
              v-model="filterValues[filter.key]"
              :options="filterSelectOptions(filter)"
              outer-class="mb-0"
            />
          </template>
        </div>
      </div>

      <!-- Columns -->
      <div class="mt-6">
        <h3 class="font-semibold mb-3">Columns</h3>
        <div class="border border-gray-200 rounded-md p-3 bg-[rgb(var(--bg-1))]">
          <FormKit
            type="checkbox"
            :options="columnOptions"
            v-model="selectedColumns"
            outer-class="mb-0"
            :classes="{
              options: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1',
            }"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
        <rs-button variant="primary-outline" :disabled="previewLoading" @click="generatePreview">
          <Icon name="ic:outline-visibility" class="mr-1" />
          {{ previewLoading ? "Loading..." : "Preview" }}
        </rs-button>
        <rs-button :disabled="downloading" @click="downloadExcel">
          <Icon name="ic:outline-file-download" class="mr-1" />
          {{ downloading ? "Generating..." : "Download Excel" }}
        </rs-button>
      </div>

      <div
        v-if="message"
        class="mt-4 p-3 rounded-md text-sm"
        :class="{
          'bg-red-100 text-red-700': messageType === 'error',
          'bg-green-100 text-green-700': messageType === 'success',
          'bg-blue-100 text-blue-700': messageType === 'info',
        }"
      >
        {{ message }}
      </div>
    </div>

    <!-- Preview -->
    <div v-if="previewFields.length" class="card p-4 mt-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <h3 class="font-semibold">Preview</h3>
        <span class="text-sm text-gray-500">
          Showing {{ previewShown }} of {{ previewTotal }} rows
        </span>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm border border-gray-200">
          <thead class="bg-[rgb(var(--bg-1))]">
            <tr>
              <th
                v-for="field in previewFields"
                :key="field"
                class="px-3 py-2 text-left font-semibold border-b border-gray-200 whitespace-nowrap"
              >
                {{ field }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in previewRows"
              :key="index"
              class="odd:bg-[rgb(var(--bg-1))]"
            >
              <td
                v-for="field in previewFields"
                :key="field"
                class="px-3 py-2 border-b border-gray-100 whitespace-nowrap"
              >
                {{ row[field] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
