import type { StockLevels } from "@/lib/stock-level-helpers";
import { EMPTY_STOCK_LEVELS } from "@/lib/stock-level-helpers";

export type Role =
  | "Administrateur"
  | "Commercial"
  | "Gestionnaire de stock"
  | "Resp. technique"
  | "Resp. parc camion"
  | "Technicien / monteur"
  | "Utilisateur lambda"
  | "Supervision (hérité)";

export type OrderStatusUi = "PENDING" | "IN_PROGRESS" | "SETTLED";

export type EventStatus = "Planifié" | "En préparation" | "Prêt" | "Terminé" | "Annulé";

export type MovementType =
  | "Entrée"
  | "Sortie"
  | "Transfert"
  | "Ajustement"
  | "Perte/Casse"
  | "Retour"
  | "Réception"
  | "Perte";

export type ReturnCondition = "Bon état" | "Endommagé" | "Perdu" | "À réparer";

export type ArticleCondition = "Neuf" | "Bon" | "À réparer" | "Obsolète";

export type ArticleVariant = {
  id: string;
  sku: string;
  label: string;
  size: string;
  color: string;
  modelName: string;
  qtyTotal: number;
  qtyAff: number;
  valUnit: number;
  rentalPrice: number | null;
  salePrice: number | null;
  seuilMin: number;
  stockLevels: StockLevels;
  condition: ArticleCondition;
  barcode: string;
};

export type Article = {
  id: string;
  nom: string;
  ref: string;
  cat: string;
  hasVariants: boolean;
  variants: ArticleVariant[];
  description: string;
  photoUrl: string;
  galleryUrls: string[];
  brand: string;
  model: string;
  variant: string;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  barcode: string;
  serialNumber: string;
  lotNumber: string;
  supplierName: string;
  qtyTotal: number;
  qtyAff: number;
  valUnit: number;
  rentalPrice: number | null;
  salePrice: number | null;
  usefulLifeMonths: number | null;
  seuilMin: number;
  stockLevels: StockLevels;
  emoji: string;
  notes: string;
  condition: ArticleCondition;
  customFields: Record<string, string | number | boolean>;
  technicalParams: string;
  certifications: string[];
  safetyStandards: string[];
  specialInstructions: string;
};

export function emptyArticleFields(): Omit<
  Article,
  "id" | "nom" | "ref" | "cat" | "qtyTotal" | "qtyAff" | "valUnit" | "seuilMin"
> {
  return {
    hasVariants: false,
    variants: [],
    description: "",
    photoUrl: "",
    galleryUrls: [],
    brand: "",
    model: "",
    variant: "",
    weightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    barcode: "",
    serialNumber: "",
    lotNumber: "",
    supplierName: "",
    rentalPrice: null,
    salePrice: null,
    usefulLifeMonths: null,
    emoji: "📦",
    notes: "",
    condition: "Bon",
    customFields: {},
    technicalParams: "",
    certifications: [],
    safetyStandards: [],
    specialInstructions: "",
    stockLevels: { ...EMPTY_STOCK_LEVELS },
  };
}

export { EMPTY_STOCK_LEVELS };

export type Evenement = {
  id: string;
  nom: string;
  client: string;
  debut: string;
  fin: string;
  lieu: string;
  resp: string;
  statut: EventStatus;
  orderStatus?: OrderStatusUi;
  notes: string;
  /** Quantité planifiée via EventItem (affectations sans sortie physique). */
  itemsAffectes: number;
};

export type Movement = {
  id: string;
  type: MovementType;
  articleId: string;
  qty: number;
  signedQty: number;
  reason: string;
  fromLabel: string;
  toLabel: string;
  evId: string;
  operateur: string;
  etat: string;
  note: string;
  date: string;
};

export type Utilisateur = {
  id: string;
  /** Identifiant de connexion côté API (sans @). */
  username?: string | null;
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

