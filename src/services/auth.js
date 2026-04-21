import { supabase } from '../lib/supabaseClient';
import { appendAuditLog } from './auditLogs';
import { getCurrentTenantId, getTenantMembership } from './tenants';

// --- Simple in-memory cache for getCurrentUser ---
const USER_CACHE_TTL_MS = 60_000; // 60 seconds
let userCache = null; // { user, timestamp } | null

function invalidateUserCache() {
  userCache = null;
}

// Sign up (for admin)
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;

  // Optionally add to admin_users table
  if (data.user) {
    const tenantId = await getCurrentTenantId().catch(() => null);
    if (tenantId) {
      await supabase.from('tenant_members').insert([{
        tenant_id: tenantId,
        user_id: data.user.id,
        email: data.user.email,
        role: 'owner_admin',
      }]);
    }

    appendAuditLog({
      action: 'admin.auth.signup',
      description: 'Admin account signed up',
      userId: data.user.id,
      userEmail: data.user.email
    });
  }

  invalidateUserCache();
  return data;
}

// Sign in
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  appendAuditLog({
    action: 'admin.auth.login',
    description: 'Admin logged in',
    userId: data?.user?.id || null,
    userEmail: data?.user?.email || email || null
  });

  invalidateUserCache();
  return data;
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
  invalidateUserCache();
}

// Get current user (cached)
export async function getCurrentUser() {
  const now = Date.now();
  if (userCache && now - userCache.timestamp < USER_CACHE_TTL_MS) {
    return userCache.user;
  }

  const { data } = await supabase.auth.getUser();
  userCache = { user: data.user, timestamp: now };
  return data.user;
}

// Listen to auth state changes
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// Check if user is admin (optional - can expand)
export async function isAdmin() {
  const user = await getCurrentUser();

  if (!user) return false;

  const tenantId = await getCurrentTenantId().catch(() => null);
  if (!tenantId) return false;
  return !!(await getTenantMembership(tenantId));
}

/**
 * Change the current user's password
 * @param {string} currentPassword - The user's current password
 * @param {string} newPassword - The new password to set
 * @returns {Promise} - Resolves if successful, rejects with error if not
 */
export async function changePassword(currentPassword, newPassword) {
  // First, verify the current password by attempting to sign in
  const user = await getCurrentUser();

  if (!user || !user.email) {
    throw new Error('No authenticated user found');
  }

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    throw new Error('Current password is incorrect');
  }

  // If current password is correct, update to new password
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  appendAuditLog({
    action: 'admin.auth.change_password',
    description: 'Admin changed password',
    userId: user.id,
    userEmail: user.email
  });

  return data;
}

/**
 * Send a password reset email
 * @param {string} email - The email address to send the reset link to
 */
export async function sendPasswordResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/admin/reset-password`,
  });

  if (error) {
    throw error;
  }
}
