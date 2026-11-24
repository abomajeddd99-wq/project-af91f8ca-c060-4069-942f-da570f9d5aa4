export function validateCareerSelection(roleId: string, roles: { id: string; is_active: boolean }[]) {
  return roles.some((role) => role.id === roleId && role.is_active);
}

export function assignedStandards<T extends { owner_id: string | null; criteria_version_id: string | null }>(
  standards: T[], versions: { id: string; status: string }[],
): T[] {
  const published = new Set(versions.filter((v) => v.status === "published").map((v) => v.id));
  return standards.filter((s) => s.owner_id !== null || (s.criteria_version_id !== null && published.has(s.criteria_version_id)));
}