/**
 * AuthContext.jsx
 *
 * Manages the application's authentication state using Supabase Auth.
 * Listens for session changes reactively and exposes user/profile data
 * along with login/logout helpers to the rest of the app.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Supabase auth user object
  const [profile, setProfile] = useState(null); // Row from the `profiles` table
  const [authLoading, setAuthLoading] = useState(true); // True until initial session check completes

  /** Fetches the matching profile row for a given auth user ID. */
  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Could not fetch profile for user:', userId, error.message);
      return null;
    }
    return data;
  }, []);

  // On mount: eagerly fetch the current session so we have a definitive answer
  // before rendering any routes. This prevents the race condition where
  // onAuthStateChange fires asynchronously and authLoading briefly becomes false
  // with user=null, allowing unauthenticated access to protected routes.
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        const profileData = await fetchProfile(session.user.id);
        if (mounted) setProfile(profileData);
      } else {
        setUser(null);
        setProfile(null);
      }

      if (mounted) setAuthLoading(false);
    };

    init();

    // Also subscribe to ongoing auth changes (login, logout, token refresh,
    // or changes from another tab) so the UI stays in sync after initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          if (mounted) setProfile(profileData);
        } else {
          setUser(null);
          setProfile(null);
        }

        // Do NOT set authLoading here — it was already cleared by init().
        // Setting it again would cause unnecessary re-renders.
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  /**
   * Signs in the user with email and password via Supabase Auth.
   * Returns { error } so the caller can display error messages.
   */
  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  /**
   * Signs the current user out and clears local state.
   */
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
