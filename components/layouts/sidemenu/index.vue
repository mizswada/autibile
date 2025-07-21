<script setup>
import { getNavigationByRole } from "~/navigation/index.js";
import RSItem from "~/components/layouts/sidemenu/Item.vue";
import { useUserStore } from "~/stores/user";

const userStore = useUserStore();

// Get navigation based on user roles
const menuItem = computed(() => {
  const userRoles = userStore.roles || [];
  return getNavigationByRole(userRoles);
});

// Watch for role changes and update navigation
watch(() => userStore.roles, (newRoles) => {
  // Navigation will automatically update due to computed property
}, { deep: true });

onMounted(() => {
  try {
    const el = document.querySelector(".active-menu").closest(".menu-content");
    const elParent = el.parentElement.parentElement;

    if (elParent) {
      elParent.classList.remove("hide");
      elParent.querySelector("a").classList.add("nav-open");
    }
    if (el) el.classList.remove("hide");
  } catch (e) {
    // console.log(e);
    return;
  }
});
</script>

<template>
  <div class="vertical-menu">
    <div class="py-2 px-4">
      <nuxt-link to="/">
        <div class="flex flex-auto gap-3 justify-center items-center h-[48px]">
          <img
            class="h-10 block"
            src="@/assets/img/logo/logo-word-black.svg"
            alt=""
          />
        </div>
      </nuxt-link>
    </div>
    <NuxtScrollbar
      class="flex flex-col justify-between my-6"
      style="max-height: 82dvh"
    >
      <RSItem :items="menuItem"></RSItem>
    </NuxtScrollbar>
  </div>
</template>
