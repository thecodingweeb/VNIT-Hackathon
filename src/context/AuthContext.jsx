import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to format user profile data
  const formatUserProfile = async (supabaseUser) => {
    if (!supabaseUser) return null;

    let role = supabaseUser.user_metadata?.role || 'RANGE_OFFICER';
    let fullName = supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0];

    // Try fetching extended profile from Supabase profiles table
    if (supabase) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, username')
          .eq('id', supabaseUser.id)
          .maybeSingle();

        if (profile) {
          role = profile.role || role;
          fullName = profile.full_name || fullName;
        }
      } catch (err) {
        console.warn('Profile fetch warning:', err);
      }
    }

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: fullName,
      role: role.replace('_', ' '),
      zone: 'Pench Tiger Reserve',
      avatar: (fullName || supabaseUser.email).slice(0, 2).toUpperCase(),
    };
  };

  useEffect(() => {
    // 1. Check existing session on load
    const initializeAuth = async () => {
      setLoading(true);
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          const profile = await formatUserProfile(session.user);
          setUser(profile);
        } else {
          setUser(null);
        }
      } else {
        const local = localStorage.getItem('tigerwatch_user');
        if (local) setUser(JSON.parse(local));
      }
      setLoading(false);
    };

    initializeAuth();

    // 2. Listen to real-time auth state changes from Supabase
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const profile = await formatUserProfile(session.user);
          setUser(profile);
          localStorage.setItem('tigerwatch_user', JSON.stringify(profile));
        } else {
          setUser(null);
          localStorage.removeItem('tigerwatch_user');
        }
        setLoading(false);
      });

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, []);

  // Strict Login handler using Supabase Auth
  const login = async (email, password) => {
    setLoading(true);
    if (!supabase) {
      setLoading(false);
      return { success: false, error: 'Database connection is not configured.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setLoading(false);
        return {
          success: false,
          error: error.message === 'Invalid login credentials'
            ? 'Invalid email or password. Please check your credentials.'
            : error.message
        };
      }

      if (data?.user) {
        const profile = await formatUserProfile(data.user);
        setUser(profile);
        setSession(data.session);
        setLoading(false);
        return { success: true, user: profile };
      }

      setLoading(false);
      return { success: false, error: 'Authentication failed.' };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
  };

  // Sign Up / Register new authorized officer
  const register = async ({ email, password, fullName, role = 'RANGE_OFFICER' }) => {
    setLoading(true);
    if (!supabase) {
      setLoading(false);
      return { success: false, error: 'Database connection is not configured.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
            username: email.split('@')[0],
          }
        }
      });

      if (error) {
        setLoading(false);
        return { success: false, error: error.message };
      }

      if (data?.user) {
        const profile = await formatUserProfile(data.user);
        setUser(profile);
        setSession(data.session);
        setLoading(false);
        return { success: true, user: profile, session: data.session };
      }

      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.message || 'Registration failed.' };
    }
  };

  // Sign Out
  const logout = async () => {
    setLoading(true);
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    setSession(null);
    localStorage.removeItem('tigerwatch_user');
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
