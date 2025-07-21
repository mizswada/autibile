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
  getters: {
    // Check if user is admin
    isAdmin: (state) => {
      return state.roles?.some(role => 
        role.includes('Admin') || role.includes('Administrator')
      ) || false;
    },
    
    // Check if user is doctor
    isDoctor: (state) => {
      return state.roles?.some(role => 
        role.includes('Practitioners') || role.includes('Doctor')
      ) || false;
    },
    
    // Get user role type
    userRoleType: (state) => {
      if (state.roles?.some(role => role.includes('Admin') || role.includes('Administrator'))) {
        return 'admin';
      } else if (state.roles?.some(role => role.includes('Practitioners') || role.includes('Doctor'))) {
        return 'doctor';
      }
      return 'unknown';
    }
  },
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
    
    // Clear user data on logout
    clearUser() {
      this.userID = null;
      this.username = null;
      this.roles = null;
      this.isAuth = false;
    },
  },
});
