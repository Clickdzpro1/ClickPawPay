import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { tokenStorage } from '../utils/api'

export const useConfigStore = create(
  persist(
    (set) => ({
      // Whether the user has ever registered (persisted)
      isConfigured: false,
      // Whether the user is currently logged in (JWT present)
      isLoggedIn: false,
      // Current tenant info (populated after login)
      tenant: null,

      // Login: store JWT and mark as authenticated
      login: (token, tenant) => {
        tokenStorage.set(token)
        set({ isLoggedIn: true, isConfigured: true, tenant })
      },

      // Logout: clear JWT and auth state, keep isConfigured (so we show Login, not Setup)
      logout: () => {
        tokenStorage.clear()
        set({ isLoggedIn: false, tenant: null })
      },

      // Full reset: used when user wants to start fresh (re-register)
      resetConfig: () => {
        tokenStorage.clear()
        set({
          isConfigured: false,
          isLoggedIn:   false,
          tenant:       null
        })
      }
    }),
    {
      name: 'clickpawpay-config',
      // Bump version whenever the persisted shape changes.
      // Zustand calls migrate() if stored version < this number, wiping stale data.
      version: 1,
      migrate: () => ({ isConfigured: false, isLoggedIn: false, tenant: null }),
      // Only persist these keys — token lives in localStorage separately
      partialize: (state) => ({
        isConfigured: state.isConfigured,
        isLoggedIn:   state.isLoggedIn,
        tenant:       state.tenant
      })
    }
  )
)
