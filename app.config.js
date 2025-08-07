// app.config.ts
export default defineAppConfig({
  nuxtIcon: {
    size: "24px", // default <Icon> size applied
    aliases: {
      nuxt: "logos:nuxt-icon",
    },
    // Add Material Symbols support
    class: "icon",
    classPrefix: "icon-",
  },
});
