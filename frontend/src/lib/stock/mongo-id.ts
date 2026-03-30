const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function isValidMongoObjectId(id: string): boolean {
  return OBJECT_ID_RE.test(id);
}

/** À utiliser avant un PATCH/DELETE vers l’API (les ids de démo type « a3 » ne sont pas des ObjectId). */
export function assertMongoApiId(id: string, label: string): void {
  if (!isValidMongoObjectId(id)) {
    throw new Error(
      `${label} : identifiant local ou invalide. Recharge la page pour synchroniser avec le serveur, ou crée une nouvelle fiche.`,
    );
  }
}
