 import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User, LoginCredentials, AuthState, authenticateUser, updateUserProfile } from '@/lib/auth';
import { apiClient, checkBackendAvailability } from '@/lib/api';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: User) => void;
  isBackendAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_BACKEND_AVAILABLE'; payload: boolean };

const authReducer = (state: AuthState & { isBackendAvailable: boolean }, action: AuthAction): AuthState & { isBackendAvailable: boolean } => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_BACKEND_AVAILABLE':
      return {
        ...state,
        isBackendAvailable: action.payload,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

const initialState: AuthState & { isBackendAvailable: boolean } = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading true
  isBackendAvailable: false,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing session and backend availability on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Initializing authentication...
        // First, check if we have a saved user in localStorage
        const savedUser = localStorage.getItem('tristar_fitness_user');
        const savedToken = localStorage.getItem('auth_token');
        
        // Checking saved user and token
        
        // Check backend availability with a shorter timeout
        const backendAvailable = await Promise.race([
          checkBackendAvailability(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)) // 2 second timeout
        ]);
        // Backend availability checked
        dispatch({ type: 'SET_BACKEND_AVAILABLE', payload: backendAvailable });

        if (backendAvailable && savedToken) {
          // We have a token, try to validate it with backend
          try {
            // Restore token to apiClient
            apiClient.setToken(savedToken);
            
            const response = await apiClient.getCurrentUser();
            if (response.success && response.data) {
              // Backend token validation successful
              dispatch({ type: 'LOGIN_SUCCESS', payload: response.data });
              return;
            }
          } catch (error) {
            console.warn('Token validation failed, falling back to local storage');
            apiClient.clearToken();
            // Continue to local storage fallback
          }
        }

        // Fallback to local storage if backend is not available or token is invalid
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser);
            // If we have a saved token, restore it
            if (savedToken) {
              apiClient.setToken(savedToken);
            }
            // Local storage fallback successful
            dispatch({ type: 'LOGIN_SUCCESS', payload: user });
            return; // Add return to prevent further execution
          } catch (error) {
            console.error('Error parsing saved user:', error);
            localStorage.removeItem('tristar_fitness_user');
            localStorage.removeItem('auth_token');
          }
        }
        
        // If we reach here, no valid session was found
        console.log('❌ No valid session found, setting login failure');
        dispatch({ type: 'LOGIN_FAILURE' });
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: 'LOGIN_FAILURE' });
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      // Use cached backend availability or check quickly
      const backendAvailable = state.isBackendAvailable || await Promise.race([
        checkBackendAvailability(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)) // 1 second timeout
      ]);
      
      if (backendAvailable) {
        try {
          const resp = await apiClient.login(credentials.username, credentials.password);
          // apiClient.login returns ApiResponse with token and user
          if (resp.success && (resp as any).token) {
            const user = (resp as any).user as User;
            dispatch({ type: 'LOGIN_SUCCESS', payload: user });
            return true;
          }
        } catch (e) {
          console.warn('Backend login failed, attempting local fallback');
          // continue to local fallback below
        }
      }

      // Fallback to local authentication if backend is not available
      const user = authenticateUser(credentials);
      if (user) {
        // Create a demo token for offline mode
        const demoToken = `demo-token-${Date.now()}`;
        apiClient.setToken(demoToken);
        localStorage.setItem('auth_token', demoToken);
        localStorage.setItem('tristar_fitness_user', JSON.stringify(user));
        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        return true;
      }

      dispatch({ type: 'LOGIN_FAILURE' });
      return false;
    } catch (error) {
      console.error('Login error:', error);
      dispatch({ type: 'LOGIN_FAILURE' });
      return false;
    }
  };

  const logout = async () => {
    try {
      if (state.isBackendAvailable) {
        await apiClient.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
      localStorage.removeItem('tristar_fitness_user');
      localStorage.removeItem('auth_token'); // Also remove the token
      apiClient.clearToken();
    }
  };

  const updateUser = (updatedUser: User) => {
    // Update the user in the global auth system
    if (updatedUser.id) {
      const result = updateUserProfile(updatedUser.id, updatedUser);
      if (result) {
        // Update the context state
        dispatch({ type: 'UPDATE_USER', payload: result });
        console.log('✅ User profile updated successfully:', result.name);
      }
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


