<script>
export default {
  data() {
    return {
      formType: 'progress', // 'progress' or 'payment'
      // Progress report fields
      parentName: '',
      childName: '',
      childId: '',
      // Payment report fields
      referenceId: '',
    };
  },
  methods: {
    searchReport() {
      if (this.formType === 'progress') {
        console.log('Generating Progress Report:');
        console.log('Parent Name:', this.parentName);
        console.log('Child Name:', this.childName);
        console.log('Child ID:', this.childId);
      } else if (this.formType === 'payment') {
        console.log('Generating Payment Report:');
        console.log('Reference ID:', this.referenceId);
      }
    }
  }
};
</script>
<template>
    <rs-collapse>
        <rs-collapse-item title="Report Generator">
            <div class="mb-4">
                <label>
                    <input type="radio" value="progress" v-model="formType" /> Progress Report
                </label>
                <label class="ml-4">
                    <input type="radio" value="payment" v-model="formType" /> Payment
                </label>
            </div>
            <div v-if="formType === 'progress'">
                <FormKit type="text" label="Parent Name" v-model="parentName" />
                <FormKit type="text" label="Child Name" v-model="childName" />
                <FormKit type="text" label="Child ID" v-model="childId" />
            </div>
            <div v-else-if="formType === 'payment'">
                <FormKit type="text" label="Reference ID" v-model="referenceId" />
            </div>
            <div class="flex justify-end space-x-4 mt-4">
                <button @click="searchReport" class="bg-green-500 text-white px-4 py-2 rounded">Generate</button>
            </div>
        </rs-collapse-item>
    </rs-collapse>
</template>