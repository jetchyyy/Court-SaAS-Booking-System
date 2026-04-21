import { supabase } from '../lib/supabaseClient';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const PLATFORM_HOSTNAME = import.meta.env.VITE_PLATFORM_HOSTNAME || 'localhost';

let tenantCache = null;
let tenantCacheHost = null;

function normalizeHostname(hostname = '') {
  return String(hostname || '').split(':')[0].toLowerCase();
}

export function getCurrentHostname() {
  if (typeof window === 'undefined') return 'localhost';
  return normalizeHostname(window.location.hostname);
}

export function isPlatformHost() {
  const hostname = getCurrentHostname();
  return hostname === normalizeHostname(PLATFORM_HOSTNAME) || LOCAL_HOSTS.has(hostname);
}

export function clearTenantCache() {
  tenantCache = null;
  tenantCacheHost = null;
}

export async function getCurrentTenant({ force = false } = {}) {
  const hostname = getCurrentHostname();

  if (!force && tenantCache && tenantCacheHost === hostname) {
    return tenantCache;
  }

  const { data, error } = await supabase.rpc('get_tenant_by_domain', {
    p_hostname: hostname,
  });

  if (error) {
    console.error('getCurrentTenant error:', error);
    throw new Error('Unable to load this booking site.');
  }

  tenantCache = data || null;
  tenantCacheHost = hostname;
  return tenantCache;
}

export async function getCurrentTenantId(options) {
  const tenant = await getCurrentTenant(options);
  if (!tenant?.id) {
    throw new Error('No active tenant is configured for this domain.');
  }
  return tenant.id;
}

export async function getTenantMembership(tenantId) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId || !tenantId) return null;

  const { data, error } = await supabase
    .from('tenant_members')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getTenantMembership error:', error);
    return null;
  }

  return data || null;
}

export async function isPlatformAdmin() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('isPlatformAdmin error:', error);
    return false;
  }

  return !!data;
}
