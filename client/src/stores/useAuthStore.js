// /client/src/stores/useAuthStore.js
import { create } from 'zustand';
import { api } from '../api/axios';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Initialize auth state from localStorage or check session
   */
  initialize: async () => {
    try {
      const response = await api.get('/auth/me');
      set({ 
        user: response.data.data, 
        isAuthenticated: true,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      });
    }
  },

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   */
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    set({ 
      user: response.data.data.user, 
      isAuthenticated: true 
    });
    return response.data;
  },

  /**
   * Register new user
   * @param {string} name
   * @param {string} email
   * @param {string} password
   */
  register: async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore errors, clear local state anyway
    }
    set({ user: null, isAuthenticated: false });
  },

  /**
   * Update user profile
   * @param {object} updates
   */
  updateUser: (updates) => {
    set((state) => ({
      user: { ...state.user, ...updates }
    }));
  },

  /**
   * Clear auth state
   */
  clear: () => {
    set({ user: null, isAuthenticated: false });
  }
}));
