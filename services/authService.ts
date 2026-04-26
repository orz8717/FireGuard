import { User } from '../types';
import { supabase, getSupabaseAdmin } from './supabaseClient';

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        this.currentUser = null;
        localStorage.removeItem('fireguard_session');
      }
    });
  }

  async login(email: string, password?: string): Promise<User | null> {
    if (!password) return null;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      console.error('Login failed:', authError);
      return null;
    }

    // Look up app profile by email (Clerk user ID != DB UUID)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

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
      updatedAt: userData.updated_at,
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
        .maybeSingle();

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
        updatedAt: userData.updated_at,
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
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) throw new Error('כתובת האימייל כבר קיימת במערכת');

      // Create Clerk user
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed: No user data returned');

      // Insert profile into Neon users table (use a fresh UUID as the row ID)
      const newId = crypto.randomUUID();
      const { error: profileError } = await supabase.from('users').insert([{
        id: newId,
        email,
        name,
        phone,
        role: 'USER',
        is_active: true,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }]);

      if (profileError) {
        if (profileError.message?.includes('users_email_key')) {
          throw new Error('כתובת האימייל כבר קיימת במערכת');
        }
        throw profileError;
      }

      return { user: authData.user, error: null };
    } catch (error: any) {
      console.error('Signup process error:', error);
      return { user: null, error: error.message || 'An unexpected error occurred during signup' };
    }
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { password: newPassword });
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
