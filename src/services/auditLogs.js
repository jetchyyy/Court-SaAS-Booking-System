import { supabase } from '../lib/supabaseClient';

const AUDIT_STORAGE_KEY = 'adminDeveloperAuditLogsV1';
const DEV_MODE_STORAGE_KEY = 'adminDeveloperModeEnabledV1';
const AUDIT_CACHE_TTL_MS = 15_000;
const MAX_AUDIT_LOGS = 500;
const AUDIT_REMOTE_TABLE = 'admin_audit_logs';
const AUDIT_REMOTE_POLL_MS = 20_000;
const AUDIT_REMOTE_FULL_FETCH_LIMIT = 120;
const AUDIT_REMOTE_DELTA_FETCH_LIMIT = 60;

let auditCache = null;
let auditCacheTimestamp = 0;
let remoteAvailable = null; // null = unknown, true = usable, false = disabled/fallback
let syncInFlight = null;
let remotePollTimer = null;
const listeners = new Set();

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParseLogs(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((log) => log && typeof log === 'object' && log.id && log.timestamp);
  } catch {
    return [];
  }
}

function sortLogsDescending(logs) {
  return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function normalizeLog(log) {
  return {
    id: log?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: log?.action || 'admin.unknown',
    description: log?.description || '',
    userId: log?.userId || null,
    userEmail: log?.userEmail || null,
    metadata: log?.metadata || null,
    timestamp: log?.timestamp || new Date().toISOString(),
  };
}

function mapRemoteRowToLog(row) {
  return normalizeLog({
    id: row.id,
    action: row.action,
    description: row.description,
    userId: row.user_id,
    userEmail: row.user_email,
    metadata: row.metadata,
    timestamp: row.created_at,
  });
}

function mapLogToRemoteRow(log) {
  return {
    action: log.action,
    description: log.description,
    user_id: log.userId,
    user_email: log.userEmail,
    metadata: log.metadata,
    created_at: log.timestamp,
  };
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || message.includes('does not exist');
}

function setRemoteUnavailable(error) {
  remoteAvailable = false;
  console.warn('[auditLogs] Supabase remote disabled, using local fallback:', error?.message || error);
}

function emit(logs) {
  listeners.forEach((listener) => {
    try {
      listener(logs);
    } catch (err) {
      console.error('[auditLogs] listener error:', err);
    }
  });
}

function readLogsFromStorage() {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
  return safeParseLogs(raw);
}

function persistLogs(logs) {
  const normalized = sortLogsDescending((logs || []).map(normalizeLog)).slice(0, MAX_AUDIT_LOGS);

  auditCache = normalized;
  auditCacheTimestamp = Date.now();

  if (isBrowser()) {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(normalized));
  }

  emit(normalized);
  return normalized;
}

async function fetchRemoteLogs({ sinceTimestamp = null } = {}) {
  if (remoteAvailable === false) return null;

  let query = supabase
    .from(AUDIT_REMOTE_TABLE)
    .select('id, action, description, user_id, user_email, metadata, created_at');

  if (sinceTimestamp) {
    query = query
      .gt('created_at', sinceTimestamp)
      .order('created_at', { ascending: true })
      .limit(AUDIT_REMOTE_DELTA_FETCH_LIMIT);
  } else {
    query = query
      .order('created_at', { ascending: false })
      .limit(AUDIT_REMOTE_FULL_FETCH_LIMIT);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingTableError(error) || error.code === '42501') {
      setRemoteUnavailable(error);
      return null;
    }

    console.warn('[auditLogs] Remote fetch failed, keeping cached/local logs:', error.message || error);
    return null;
  }

  remoteAvailable = true;
  return (data || []).map(mapRemoteRowToLog);
}

function ensureRemotePolling() {
  if (!isBrowser() || remotePollTimer || listeners.size === 0) return;

  remotePollTimer = window.setInterval(() => {
    if (listeners.size === 0) {
      window.clearInterval(remotePollTimer);
      remotePollTimer = null;
      return;
    }

    void refreshAuditLogs();
  }, AUDIT_REMOTE_POLL_MS);
}

function stopRemotePollingIfIdle() {
  if (listeners.size === 0 && remotePollTimer) {
    window.clearInterval(remotePollTimer);
    remotePollTimer = null;
  }
}

async function pushLogToRemote(entry) {
  if (remoteAvailable === false) return;

  const { error } = await supabase
    .from(AUDIT_REMOTE_TABLE)
    .insert([mapLogToRemoteRow(entry)]);

  if (error) {
    if (isMissingTableError(error) || error.code === '42501') {
      setRemoteUnavailable(error);
      return;
    }

    console.warn('[auditLogs] Remote insert failed:', error.message || error);
    return;
  }

  remoteAvailable = true;
}

export async function refreshAuditLogs({ force = false } = {}) {
  if (syncInFlight && !force) {
    return syncInFlight;
  }

  syncInFlight = (async () => {
    const now = Date.now();
    if (!force && auditCache && now - auditCacheTimestamp < AUDIT_CACHE_TTL_MS) {
      return auditCache;
    }

    const canUseDelta = !force && Array.isArray(auditCache) && auditCache.length > 0;
    const latestTimestamp = canUseDelta ? auditCache[0]?.timestamp : null;

    const remoteLogs = await fetchRemoteLogs({ sinceTimestamp: latestTimestamp || null });
    if (remoteLogs) {
      if (latestTimestamp) {
        if (remoteLogs.length === 0) {
          auditCacheTimestamp = Date.now();
          return auditCache;
        }

        return persistLogs([...remoteLogs, ...(auditCache || [])]);
      }

      return persistLogs(remoteLogs);
    }

    const localLogs = sortLogsDescending(readLogsFromStorage()).slice(0, MAX_AUDIT_LOGS);
    return persistLogs(localLogs);
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

export function isDeveloperModeEnabled() {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === '1';
}

export function setDeveloperModeEnabled(enabled) {
  if (!isBrowser()) return;
  window.localStorage.setItem(DEV_MODE_STORAGE_KEY, enabled ? '1' : '0');
}

export function getAuditLogs({ force = false } = {}) {
  const now = Date.now();
  if (!force && auditCache && now - auditCacheTimestamp < AUDIT_CACHE_TTL_MS) {
    return auditCache;
  }

  const logs = sortLogsDescending(readLogsFromStorage()).slice(0, MAX_AUDIT_LOGS);
  auditCache = logs;
  auditCacheTimestamp = now;
  return logs;
}

export function clearAuditLogs() {
  persistLogs([]);

  return supabase.auth.getUser()
    .then(({ data }) => {
      const userId = data?.user?.id;
      if (!userId || remoteAvailable === false) return;

      return supabase
        .from(AUDIT_REMOTE_TABLE)
        .delete()
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) {
            if (isMissingTableError(error) || error.code === '42501') {
              setRemoteUnavailable(error);
              return;
            }

            console.warn('[auditLogs] Remote clear failed:', error.message || error);
            return;
          }

          remoteAvailable = true;
        });
    })
    .finally(() => {
      void refreshAuditLogs({ force: true });
    });
}

export function appendAuditLog({ action, description, userId = null, userEmail = null, metadata = null }) {
  const entry = normalizeLog({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    description,
    userId,
    userEmail,
    metadata,
    timestamp: new Date().toISOString(),
  });

  const nextLogs = [entry, ...getAuditLogs({ force: true })];
  persistLogs(nextLogs);
  void pushLogToRemote(entry);
  return entry;
}

export function subscribeToAuditLogs(listener) {
  listeners.add(listener);
  listener(getAuditLogs());
  ensureRemotePolling();
  void refreshAuditLogs({ force: true });

  return () => {
    listeners.delete(listener);
    stopRemotePollingIfIdle();
  };
}

