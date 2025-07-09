import { defineStore } from "pinia";

export const useUserStore = defineStore({
  id: "user",
  state: () => ({
    userID: null, 
    username: null,
    roles: null,
    isAuth: false,
  }),
  
  persist: true,
  actions: {
    setUsername(username) {
      this.username = username;
    },
    setUserID(userID) {
      this.userID = userID;
    },
    setRoles(roles) {
      this.roles = roles;
    },
    setIsAuthenticated(isAuth) {
      this.isAuth = isAuth;
    },
  },
});
