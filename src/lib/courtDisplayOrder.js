const STORAGE_KEY = 'homepageCourtOrderV1';

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function getHomepageCourtOrder() {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function setHomepageCourtOrder(courtIds) {
  if (!canUseStorage()) return;

  const unique = [...new Set((courtIds || []).map(String))];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
}

export function orderCourtsForHomepage(courts) {
  const list = Array.isArray(courts) ? courts : [];
  const byId = new Map(list.map((court) => [String(court.id), court]));
  const savedOrder = getHomepageCourtOrder();

  const ordered = [];
  const used = new Set();

  for (const id of savedOrder) {
    if (byId.has(id)) {
      ordered.push(byId.get(id));
      used.add(id);
    }
  }

  for (const court of list) {
    const id = String(court.id);
    if (!used.has(id)) {
      ordered.push(court);
    }
  }

  return ordered;
}

export function setCourtAsFirst(courtId, courts) {
  const id = String(courtId);
  const ordered = orderCourtsForHomepage(courts);
  const ids = ordered.map((court) => String(court.id)).filter((courtIdValue) => courtIdValue !== id);
  setHomepageCourtOrder([id, ...ids]);
}

export function moveCourtInOrder(courtId, direction, courts) {
  const ordered = orderCourtsForHomepage(courts);
  const ids = ordered.map((court) => String(court.id));
  const id = String(courtId);
  const index = ids.indexOf(id);

  if (index === -1) return ids;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) return ids;

  const [item] = ids.splice(index, 1);
  ids.splice(targetIndex, 0, item);
  setHomepageCourtOrder(ids);
  return ids;
}
