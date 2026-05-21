/** Identifiants temporaires pour la file hors ligne (testable sans AsyncStorage). */

export function newOfflineTempDocumentId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveOfflineDocumentId(
  documentId: string | undefined,
  idMap: Record<string, string>,
): string | undefined {
  if (!documentId) return undefined;
  return idMap[documentId] ?? documentId;
}
