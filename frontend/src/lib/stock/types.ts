export type Role = "Administrateur" | "Gestionnaire" | "Magasinier" | "Lecture seule";

export type EventStatus = "Planifié" | "En préparation" | "Prêt" | "Terminé" | "Annulé";

export type MovementType = "Sortie" | "Retour" | "Réception" | "Perte";

export type ReturnCondition = "Bon état" | "Endommagé" | "Perdu" | "À réparer";

export type Article = {
  id: string;
  nom: string;
  ref: string;
  cat: string;
  qtyTotal: number;
  qtyAff: number;
  valUnit: number;
  seuilMin: number;
  emoji: string;
  notes: string;
};

export type Evenement = {
  id: string;
  nom: string;
  client: string;
  debut: string;
  fin: string;
  lieu: string;
  resp: string;
  statut: EventStatus;
  notes: string;
};

export type Movement = {
  id: string;
  type: MovementType;
  articleId: string;
  qty: number;
  evId: string;
  operateur: string;
  etat: string;
  note: string;
  date: string;
};

export type Utilisateur = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  avatarUrl?: string;
  role: Role;
  actif: boolean;
};

export type ScanHistoryItem = {
  type: "Sortie" | "Retour";
  artNom: string;
  artEmoji: string;
  qty: number;
  date: string;
};

export type StockState = {
  articles: Article[];
  evenements: Evenement[];
  mouvements: Movement[];
  utilisateurs: Utilisateur[];
  scanHistory: ScanHistoryItem[];
  currentUser: string;
  calYear: number;
  calMonth: number;
  mvtFilter: string;
  catFilter: string;
};

