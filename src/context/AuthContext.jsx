import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

const DEMO_OFFICERS = [
  {
    id: 'OFF-01',
    name: 'Ranger Amit Sharma',
    email: 'amit.sharma@forest.mp.gov.in',
    role: 'Chief Wildlife Warden',
    zone: 'Pench Core & Buffer',
    avatar: 'AS',
  },
  {
    id: 'OFF-02',
    name: 'Dr. Priya Desai',
    email: 'priya.desai@wii.gov.in',
    role: 'Senior Biologist / Re-ID Specialist',
    zone: 'Research & Monitoring Wing',
    avatar: 'PD',
  },
  {
    id: 'OFF-03',
    name: 'Officer Rajesh Verma',
    email: 'r.verma@forest.mp.gov.in',
    role: 'Field Patrol Officer',
    zone: 'Turia & Buffer Sectors',
    avatar: 'RV',
  }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('tigerwatch_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If user is stored in localStorage, maintain session
    if (user) {
      localStorage.setItem('tigerwatch_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('tigerwatch_user');
    }
  }, [user]);

  // Login handler supporting both demo credentials & Supabase Auth
  const login = async (email, password) => {
    setLoading(true);
    try {
      // 1. Try Supabase Auth if configured
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (!error && data?.user) {
          const authUser = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || email.split('@')[0],
            role: 'Forest Officer',
            zone: 'Pench Tiger Reserve',
            avatar: email[0].toUpperCase()
          };
          setUser(authUser);
          setLoading(false);
          return { success: true };
        }
      }

      // 2. Demo accounts / fallback login
      const matchedOfficer = DEMO_OFFICERS.find(o => o.email.toLowerCase() === email.toLowerCase()) || {
        id: 'OFF-04',
        name: email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        email,
        role: 'Field Officer',
        zone: 'Pench Tiger Reserve',
        avatar: email.slice(0, 2).toUpperCase()
      };

      setUser(matchedOfficer);
      setLoading(false);
      return { success: true };
    } catch (err) {
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    localStorage.removeItem('tigerwatch_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, demoOfficers: DEMO_OFFICERS }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
