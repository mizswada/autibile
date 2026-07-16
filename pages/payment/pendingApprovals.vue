<script setup>
import { ref, onMounted } from "vue";

definePageMeta({
  title: "Pending Payment Approvals",
});

const loading = ref(true);
const error = ref("");
const payments = ref([]);
const rejectionReason = ref("");

const fetchPendingPayments = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await $fetch("/api/payment/listPendingPayments");
    if (response.statusCode === 200) {
      payments.value = response.data || [];
    } else {
      error.value = response.message || "Failed to load pending payments";
    }
  } catch (err) {
    console.error(err);
    error.value = "Failed to load pending payments";
  } finally {
    loading.value = false;
  }
};

const approvePayment = async (paymentID) => {
  const response = await $fetch("/api/payment/approvePayment", {
    method: "PUT",
    body: { paymentID },
  });
  if (response.statusCode !== 200) {
    alert(response.message || "Failed to approve payment");
    return;
  }
  await fetchPendingPayments();
};

const rejectPayment = async (paymentID) => {
  const reason = prompt("Optional rejection reason:", rejectionReason.value || "");
  const response = await $fetch("/api/payment/rejectPayment", {
    method: "PUT",
    body: { paymentID, reason: reason || null },
  });
  if (response.statusCode !== 200) {
    alert(response.message || "Failed to reject payment");
    return;
  }
  await fetchPendingPayments();
};

const formatPrice = (price) => Number(price || 0).toFixed(2);
const formatDate = (dateString) => new Date(dateString).toLocaleString("en-MY");

onMounted(fetchPendingPayments);
</script>

<template>
  <main>
    <LayoutsBreadcrumb />
    <rs-card class="p-6">
      <div class="flex justify-between items-center mb-5">
        <h5 class="text-xl font-semibold">Pending Payment Approvals</h5>
        <NuxtLink to="/payment">
          <rs-button variant="ghost">Back to Payment</rs-button>
        </NuxtLink>
      </div>

      <div v-if="loading" class="py-10 text-center">Loading pending payments...</div>
      <div v-else-if="error" class="py-10 text-center text-red-500">{{ error }}</div>
      <div v-else-if="payments.length === 0" class="py-10 text-center text-gray-500">
        No pending parent payments.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4">Patient</th>
              <th class="text-left py-3 px-4">Invoice</th>
              <th class="text-left py-3 px-4">Amount</th>
              <th class="text-left py-3 px-4">Method</th>
              <th class="text-left py-3 px-4">Bank</th>
              <th class="text-left py-3 px-4">Reference</th>
              <th class="text-left py-3 px-4">Submitted</th>
              <th class="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in payments" :key="payment.payment_id" class="border-b border-gray-100">
              <td class="py-3 px-4">{{ payment.user_patients?.fullname || "N/A" }}</td>
              <td class="py-3 px-4">
                INV-{{ String(payment.invoice_id).padStart(3, "0") }}<br />
                <span class="text-xs text-gray-500">{{ payment.invoice?.description || "N/A" }}</span>
              </td>
              <td class="py-3 px-4">RM {{ formatPrice(payment.amount) }}</td>
              <td class="py-3 px-4">{{ payment.method || "N/A" }}</td>
              <td class="py-3 px-4">{{ payment.bank_name || "-" }}</td>
              <td class="py-3 px-4">{{ payment.reference_code || "-" }}</td>
              <td class="py-3 px-4">{{ formatDate(payment.created_at) }}</td>
              <td class="py-3 px-4">
                <div class="flex gap-2">
                  <rs-button size="sm" variant="success" @click="approvePayment(payment.payment_id)">Approve</rs-button>
                  <rs-button size="sm" variant="danger" @click="rejectPayment(payment.payment_id)">Reject</rs-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </rs-card>
  </main>
</template>
