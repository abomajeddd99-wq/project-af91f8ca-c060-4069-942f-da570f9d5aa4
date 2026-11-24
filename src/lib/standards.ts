/** Shared (official / placeholder) sections first by their configured order, then the teacher's own sections by creation time. */
export function sortStandards<T extends { owner_id: string | null; sort_order: number; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ac = a.owner_id ? 1 : 0;
    const bc = b.owner_id ? 1 : 0;
    if (ac !== bc) return ac - bc;
    if (!ac && a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

export function isCustomSection(s: { owner_id: string | null }): boolean {
  return s.owner_id !== null;
}
