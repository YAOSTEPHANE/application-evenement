import { dispo, uid } from "./helpers";
import { currentUserName, getArticle } from "./selectors";
import type { ReturnCondition, StockState } from "./types";

function withHeadMovement(state: StockState, movement: StockState["mouvements"][number]): StockState {
  return { ...state, mouvements: [movement, ...state.mouvements] };
}

export function saveArticleAction(
  state: StockState,
  payload: {
    id?: string;
    nom: string;
    ref: string;
    cat: string;
    qtyTotal: number;
    valUnit: number;
    seuilMin: number;
    emoji: string;
    notes: string;
  },
) {
  const nom = payload.nom.trim();
  if (!nom) {
    throw new Error("Le nom est obligatoire");
  }

  if (payload.id) {
    const index = state.articles.findIndex((article) => article.id === payload.id);
    if (index < 0) {
      throw new Error("Article introuvable");
    }

    const nextArticles = [...state.articles];
    nextArticles[index] = {
      ...nextArticles[index],
      ...payload,
      nom,
    };
    return { nextState: { ...state, articles: nextArticles }, message: "Article mis à jour" };
  }

  const nextArticles = [
    ...state.articles,
    {
      id: uid(),
      nom,
      ref: payload.ref.trim(),
      cat: payload.cat,
      qtyTotal: payload.qtyTotal,
      qtyAff: 0,
      valUnit: payload.valUnit,
      seuilMin: payload.seuilMin,
      emoji: payload.emoji || "📦",
      notes: payload.notes.trim(),
    },
  ];

  return { nextState: { ...state, articles: nextArticles }, message: "Article ajouté au catalogue" };
}

export function saveEventAction(
  state: StockState,
  payload: {
    id?: string;
    nom: string;
    client: string;
    debut: string;
    fin: string;
    lieu: string;
    resp: string;
    statut: StockState["evenements"][number]["statut"];
    notes: string;
  },
) {
  const nom = payload.nom.trim();
  if (!nom) {
    throw new Error("Le nom est obligatoire");
  }

  if (payload.id) {
    const index = state.evenements.findIndex((event) => event.id === payload.id);
    if (index < 0) {
      throw new Error("Événement introuvable");
    }

    const nextEvents = [...state.evenements];
    nextEvents[index] = { ...nextEvents[index], ...payload, nom };
    return { nextState: { ...state, evenements: nextEvents }, message: "Événement mis à jour" };
  }

  const nextEvents = [
    ...state.evenements,
    {
      id: uid(),
      nom,
      client: payload.client.trim(),
      debut: payload.debut,
      fin: payload.fin,
      lieu: payload.lieu.trim(),
      resp: payload.resp,
      statut: payload.statut,
      notes: payload.notes.trim(),
    },
  ];

  return { nextState: { ...state, evenements: nextEvents }, message: "Événement créé" };
}

export function saveAffectationAction(
  state: StockState,
  payload: {
    evId: string;
    artId: string;
    qty: number;
  },
) {
  const article = getArticle(state, payload.artId);
  if (!article) {
    throw new Error("Article introuvable");
  }

  if (payload.qty > dispo(article)) {
    throw new Error(`Stock insuffisant — seulement ${dispo(article)} disponibles`);
  }

  const nextArticles = state.articles.map((a) =>
    a.id === payload.artId ? { ...a, qtyAff: (a.qtyAff || 0) + payload.qty } : a,
  );

  const nextState = withHeadMovement(
    { ...state, articles: nextArticles },
    {
      id: uid(),
      type: "Sortie",
      articleId: payload.artId,
      qty: payload.qty,
      evId: payload.evId,
      operateur: currentUserName(state),
      etat: "",
      note: "Affectation événement",
      date: new Date().toISOString(),
    },
  );

  return { nextState, message: `${payload.qty}× ${article.nom} affecté à l'événement` };
}

export function saveSortieAction(
  state: StockState,
  payload: {
    artId: string;
    qty: number;
    evId: string;
    note: string;
  },
) {
  const article = getArticle(state, payload.artId);
  if (!article) {
    throw new Error("Article introuvable");
  }

  if (payload.qty > dispo(article)) {
    throw new Error(`Stock insuffisant — ${dispo(article)} disponible(s)`);
  }

  const nextArticles = state.articles.map((a) =>
    a.id === payload.artId ? { ...a, qtyAff: (a.qtyAff || 0) + payload.qty } : a,
  );

  const nextState = withHeadMovement(
    { ...state, articles: nextArticles },
    {
      id: uid(),
      type: "Sortie",
      articleId: payload.artId,
      qty: payload.qty,
      evId: payload.evId,
      operateur: currentUserName(state),
      etat: "",
      note: payload.note.trim(),
      date: new Date().toISOString(),
    },
  );

  return { nextState, message: `Sortie de ${payload.qty}× ${article.nom} enregistrée` };
}

export function saveRetourAction(
  state: StockState,
  payload: {
    artId: string;
    qty: number;
    evId: string;
    etat: ReturnCondition;
    note: string;
  },
) {
  const article = getArticle(state, payload.artId);
  if (!article) {
    throw new Error("Article introuvable");
  }

  const nextArticles = state.articles.map((a) => {
    if (a.id !== payload.artId) {
      return a;
    }

    const retQty = payload.etat === "Perdu" ? 0 : payload.qty;
    let nextQtyAff = Math.max(0, (a.qtyAff || 0) - retQty);
    let nextQtyTotal = a.qtyTotal || 0;

    if (payload.etat === "Perdu" || payload.etat === "Endommagé") {
      const perdu = payload.etat === "Perdu" ? payload.qty : 0;
      nextQtyTotal = Math.max(0, nextQtyTotal - perdu);
      nextQtyAff = Math.max(0, nextQtyAff - payload.qty);
    }

    return {
      ...a,
      qtyAff: nextQtyAff,
      qtyTotal: nextQtyTotal,
    };
  });

  const nextState = withHeadMovement(
    { ...state, articles: nextArticles },
    {
      id: uid(),
      type: "Retour",
      articleId: payload.artId,
      qty: payload.qty,
      evId: payload.evId,
      operateur: currentUserName(state),
      etat: payload.etat,
      note: payload.note.trim(),
      date: new Date().toISOString(),
    },
  );

  return { nextState, message: `Retour de ${payload.qty}× ${article.nom} — ${payload.etat}` };
}

export function saveUserAction(
  state: StockState,
  payload: {
    prenom: string;
    nom: string;
    email: string;
    role: StockState["utilisateurs"][number]["role"];
  },
) {
  const prenom = payload.prenom.trim();
  const nom = payload.nom.trim();
  const email = payload.email.trim();
  if (!prenom || !nom || !email) {
    throw new Error("Tous les champs obligatoires");
  }

  const nextUsers = [
    ...state.utilisateurs,
    {
      id: uid(),
      prenom,
      nom,
      email,
      role: payload.role,
      actif: true,
    },
  ];

  return {
    nextState: { ...state, utilisateurs: nextUsers },
    message: `${prenom} ${nom} ajouté`,
  };
}

export function toggleUserActifAction(state: StockState, userId: string) {
  const user = state.utilisateurs.find((u) => u.id === userId);
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const nextUsers = state.utilisateurs.map((u) =>
    u.id === userId ? { ...u, actif: !u.actif } : u,
  );
  const nextUser = nextUsers.find((u) => u.id === userId);

  return {
    nextState: { ...state, utilisateurs: nextUsers },
    message: `${user.prenom} ${user.nom} ${nextUser?.actif ? "activé" : "désactivé"}`,
  };
}

export function deleteArticleAction(state: StockState, articleId: string) {
  const nextState: StockState = {
    ...state,
    articles: state.articles.filter((a) => a.id !== articleId),
    mouvements: state.mouvements.filter((m) => m.articleId !== articleId),
  };
  return { nextState, message: "Article supprimé" };
}

export function deleteEventAction(state: StockState, eventId: string) {
  const nextState: StockState = {
    ...state,
    evenements: state.evenements.filter((event) => event.id !== eventId),
  };
  return { nextState, message: "Événement supprimé" };
}

export function deleteUserAction(state: StockState, userId: string) {
  const nextState: StockState = {
    ...state,
    utilisateurs: state.utilisateurs.filter((user) => user.id !== userId),
  };
  return { nextState, message: "Utilisateur supprimé" };
}

