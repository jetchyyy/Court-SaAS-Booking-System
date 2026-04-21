export function orderCourtsForHomepage(courts) {
  return [...(Array.isArray(courts) ? courts : [])].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a?.sort_order)) ? Number(a.sort_order) : 0;
    const bOrder = Number.isFinite(Number(b?.sort_order)) ? Number(b.sort_order) : 0;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
  });
}

export function moveCourtId(courtIds, draggedCourtId, targetCourtId) {
  const ids = [...new Set((courtIds || []).map(String))];
  const draggedId = String(draggedCourtId || '');
  const targetId = String(targetCourtId || '');
  const fromIndex = ids.indexOf(draggedId);
  const toIndex = ids.indexOf(targetId);

  if (!draggedId || !targetId || draggedId === targetId || fromIndex === -1 || toIndex === -1) {
    return ids;
  }

  const [moved] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, moved);
  return ids;
}
