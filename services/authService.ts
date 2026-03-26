
import { User } from '../types';
import { dbService } from './dbService';
import { supabase, supabaseAdmin, supabaseAnon } from './supabaseClient';

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // Listen for auth changes to handle token expiration or refresh errors
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        this.currentUser = null;
        localStorage.removeItem('fireguard_session');
        // We might want to reload or notify the UI, but App.tsx handles state
      }
      
      // If we get an error like "Invalid Refresh Token", Supabase usually emits SIGNED_OUT
    });
  }

  async login(email: string, password?: string): Promise<User | null> {
    if (!password) return null;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error('Login failed:', authError);
      return null;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData || !userData.is_active) {
      console.error('Failed to fetch user profile or user is inactive:', userError);
      return null;
    }

    const user: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      role: userData.role,
      isActive: userData.is_active,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at
    };

    this.currentUser = user;
    localStorage.setItem('fireguard_session', JSON.stringify(user));
    return user;
  }

  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !userData || !userData.is_active) {
        console.error('Failed to fetch user profile or user is inactive:', userError);
        return null;
      }

      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        isActive: userData.is_active,
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };

      this.currentUser = user;
      return user;
    } catch (err) {
      console.error('Error in getUserProfile:', err);
      return null;
    }
  }

  async signUp(email: string, password: string, name: string, phone: string): Promise<{ user: any; error: any }> {
    try {
      // 0. Check if email already exists in public.users
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        throw new Error('כתובת האימייל כבר קיימת במערכת');
      }

      // 1. Authentication: Create user in auth.users using non-persisting client
      const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed: No user data returned');

      // 2. Profile Creation: Create or update entry in public.users
      // 3. Data Synchronization: Link using user ID
      const { error: profileError } = await supabase
        .from('users')
        .upsert([
          {
            id: authData.user.id,
            email,
            name,
            phone,
            role: 'USER',
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        ], { onConflict: 'id' });

      if (profileError) {
        console.error('Profile creation failed:', profileError);
        if (profileError.code === '23505' && profileError.message.includes('users_email_key')) {
          throw new Error('כתובת האימייל כבר קיימת במערכת');
        }
        throw profileError;
      }

      // 4. Auto-confirm email using Admin client (Bypass email verification)
      try {
        console.log('Auto-confirming email for:', authData.user.id);
        await supabaseAdmin.auth.admin.updateUserById(authData.user.id, { 
          email_confirm: true 
        });
      } catch (confirmError) {
        console.warn('Could not auto-confirm email, user might need to verify manually:', confirmError);
      }

      return { user: authData.user, error: null };
    } catch (error: any) {
      // 4. Error Handling: Provide clear feedback
      console.error('Signup process error:', error);
      return { user: null, error: error.message || 'An unexpected error occurred during signup' };
    }
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });
      return { data, error };
    } catch (error: any) {
      console.error('Update password error:', error);
      return { data: null, error: error.message || 'Failed to update password' };
    }
  }

  async logout() {
    await supabase.auth.signOut();
    this.currentUser = null;
    localStorage.removeItem('fireguard_session');
  }

  getCurrentUser(): User | null {
    if (!this.currentUser) {
      const saved = localStorage.getItem('fireguard_session');
      if (saved) this.currentUser = JSON.parse(saved);
    }
    return this.currentUser;
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();
