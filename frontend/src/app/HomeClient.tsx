"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MainContent } from "@/components/MainContent";
import { ModalAffect } from "@/components/ModalAffect";
import { ModalArticle } from "@/components/ModalArticle";
import { ModalConfirm } from "@/components/ModalConfirm";
import { ModalEvent } from "@/components/ModalEvent";
import { ModalRetour } from "@/components/ModalRetour";
import { ModalSortie } from "@/components/ModalSortie";
import { ModalCategory } from "@/components/ModalCategory";
import { ModalUser } from "@/components/ModalUser";
import { Sidebar, type PageId } from "@/components/Sidebar";
import { Toast } from "@/components/Toast";
import { Topbar } from "@/components/Topbar";
import {
  createCategoryViaApi,
  deleteArticleViaApi,
  deleteCategoryViaApi,
  deleteEventViaApi,
  deleteUserViaApi,
  fetchAuthMe,
  importCatalogueRowsViaApi,
  loadStateFromBackend,
  getApiOriginForDisplay,
  saveAffectationViaApi,
  saveArticleViaApi,
  saveEventViaApi,
  saveRetourViaApi,
  saveSortieViaApi,
  searchViaApi,
  saveUserViaApi,
  saveProfileViaApi,
  updateCategoryViaApi,
  type CategoryWithCount,
} from "@/lib/stock/api";
import { getInputValue, getSelectValue } from "@/lib/stock/dom";
import {
  buildAffectArticleOptions,
  buildArticleOptions,
  buildEventOptions,
  buildUserOptions,
} from "@/lib/stock/modalOptions";
import { globalSearch } from "@/lib/stock/search";
import { currentUserDisplay, counts } from "@/lib/stock/selectors";
import {
  applySessionToState,
  clearSession,
  getPersistedSessionUserId,
  loadStateWithSession,
  setSessionUserId,
} from "@/lib/stock/session";
import { saveState } from "@/lib/stock/storage";
import type { ReturnCondition, Role, StockState } from "@/lib/stock/types";
import { useToast } from "@/lib/stock/useToast";

const SOUND_ENABLED_KEY = "stockevent_sound_enabled";
const DEFAULT_CATEGORIES = [
  "Mobilier",
  "Audiovisuel",
  "Vaisselle",
  "Décoration",
  "Textile",
  "Éclairage",
  "Autre",
];

export default function Home() {
  const router = useRouter();

  /** Évite l’hydratation sur les champs quand une extension (ex. wfd-id) modifie le DOM. */
  const [clientReady, setClientReady] = useState(false);

  const [state, setState] = useState<StockState>(() => loadStateWithSession());
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Ignore les réponses d’un chargement API déjà remplacé par un plus récent (Strict Mode, doubles appels). */
  const refreshApiGenRef = useRef(0);
  const searchApiTimeoutRef = useRef<number | null>(null);
  const searchApiGenRef = useRef(0);
  const lastSearchActionRef = useRef<string>("");
  const [activePage, setActivePage] = useState<PageId>("dashboard");

  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [affectModalOpen, setAffectModalOpen] = useState(false);
  const [sortieModalOpen, setSortieModalOpen] = useState(false);
  const [retourModalOpen, setRetourModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<"create" | "edit">("create");
  const [categoryEditing, setCategoryEditing] = useState<CategoryWithCount | null>(null);
  const [categoriesReloadToken, setCategoriesReloadToken] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirmer");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmLabel, setConfirmLabel] = useState("Supprimer");
  const { toast, showToast } = useToast();
  const confirmCallbackRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const appCounts = useMemo(() => counts(state), [state]);
  const currentUser = useMemo(() => currentUserDisplay(state), [state]);
  const userOptions = useMemo(() => buildUserOptions(state), [state]);
  const affectArticleOptions = useMemo(() => buildAffectArticleOptions(state), [state]);
  const articleOptions = useMemo(() => buildArticleOptions(state), [state]);
  const eventOptions = useMemo(() => buildEventOptions(state, true), [state]);
  const articleCategories = useMemo(() => {
    const fromArticles = state.articles.map((article) => article.cat).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromArticles]));
  }, [state.articles]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchAuthMe();
      if (cancelled) {
        return;
      }
      if (!me) {
        clearSession();
        router.replace("/connexion");
        return;
      }
      setSessionUserId(me.id);
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function refreshStateFromApi() {
    const myGen = ++refreshApiGenRef.current;
    try {
      const snapshot = stateRef.current;
      let nextState = await loadStateFromBackend(snapshot);
      if (myGen !== refreshApiGenRef.current) {
        return;
      }
      nextState = applySessionToState(nextState);
      if (myGen !== refreshApiGenRef.current) {
        return;
      }
      setState(nextState);
      if (!getPersistedSessionUserId()) {
        router.replace("/connexion");
      }
      const me = await fetchAuthMe();
      if (myGen === refreshApiGenRef.current && !me) {
        clearSession();
        router.replace("/connexion");
        return;
      }
      if (nextState.articles.length === 0 && nextState.utilisateurs.length === 0) {
        showToast(
          `Aucune donnée côté API. Exécutez une fois : POST ${getApiOriginForDisplay()}/api/setup/seed (corps vide), puis rechargez. Vérifiez MongoDB et « npx prisma db push » (dans le dossier frontend).`,
          "default",
        );
      }
    } catch (error) {
      if (myGen !== refreshApiGenRef.current) {
        return;
      }
      const stillAuthed = await fetchAuthMe();
      if (!stillAuthed) {
        clearSession();
        router.replace("/connexion");
        return;
      }
      console.error("[StockEvent] Échec du chargement API", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Impossible de charger les données. En monolithe : npm run dev (frontend) et DATABASE_URL. Backend séparé : npm run dev:backend (3001) ou NEXT_PUBLIC_API_BASE_URL.",
        "danger",
      );
    }
  }

  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    void refreshStateFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SOUND_ENABLED_KEY);
      if (raw === null) {
        return;
      }
      setSoundEnabled(raw === "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!eventModalOpen) {
      return;
    }
    const select = document.getElementById("ev-resp") as HTMLSelectElement | null;
    if (!select) {
      return;
    }
    select.innerHTML = userOptions;
  }, [eventModalOpen, userOptions]);

  useEffect(() => {
    if (!affectModalOpen) {
      return;
    }
    const articleSelect = document.getElementById("affect-article") as HTMLSelectElement | null;
    if (articleSelect) {
      articleSelect.innerHTML = affectArticleOptions;
    }
  }, [affectModalOpen, affectArticleOptions]);

  useEffect(() => {
    if (!sortieModalOpen) {
      return;
    }
    const articleSelect = document.getElementById("sortie-article") as HTMLSelectElement | null;
    const eventSelect = document.getElementById("sortie-event") as HTMLSelectElement | null;
    if (articleSelect) {
      articleSelect.innerHTML = articleOptions;
    }
    if (eventSelect) {
      eventSelect.innerHTML = eventOptions;
    }
  }, [sortieModalOpen, articleOptions, eventOptions]);

  useEffect(() => {
    if (!retourModalOpen) {
      return;
    }
    const articleSelect = document.getElementById("retour-article") as HTMLSelectElement | null;
    const eventSelect = document.getElementById("retour-event") as HTMLSelectElement | null;
    if (articleSelect) {
      articleSelect.innerHTML = articleOptions;
    }
    if (eventSelect) {
      eventSelect.innerHTML = eventOptions;
    }
  }, [retourModalOpen, articleOptions, eventOptions]);

  function runGlobalSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    // Évite de déclencher la recherche/navigation pour des requêtes trop courtes.
    if (trimmed.length < 2) {
      return;
    }

    const localResult = globalSearch(state, trimmed);
    if (localResult) {
      setActivePage(localResult.page);
      const key = `${localResult.page}:${localResult.label}`;
      if (lastSearchActionRef.current !== key) {
        lastSearchActionRef.current = key;
        showToast(`Aller vers: ${localResult.label}`, "default");
      }
      return;
    }

    // Fallback : recherche côté API (organisation + DB) si rien en local.
    // Debounce pour éviter de lancer une requête à chaque frappe.
    const myGen = ++searchApiGenRef.current;
    if (searchApiTimeoutRef.current) {
      window.clearTimeout(searchApiTimeoutRef.current);
    }
    searchApiTimeoutRef.current = window.setTimeout(() => {
      if (myGen !== searchApiGenRef.current) {
        return;
      }
      void (async () => {
        try {
          const resp = await searchViaApi(trimmed);
          const first =
            resp.items[0]
              ? { page: "catalogue" as const, label: resp.items[0].name }
              : resp.events[0]
                ? { page: "evenements" as const, label: resp.events[0].name }
                : resp.users[0]
                  ? { page: "utilisateurs" as const, label: resp.users[0].fullName }
                  : null;

          if (!first) {
            return;
          }
          setActivePage(first.page);
          const key = `${first.page}:${first.label}`;
          if (lastSearchActionRef.current !== key) {
            lastSearchActionRef.current = key;
            showToast(`Aller vers: ${first.label}`, "default");
          }
        } catch (error) {
          showToast(
            error instanceof Error ? error.message : "Recherche impossible",
            "danger",
          );
        }
      })();
    }, 300);
  }

  function playSuccessBeep(mode: "sortie" | "retour") {
    if (!soundEnabled) {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      const playTone = (frequency: number, startOffset: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.value = 0.0001;

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        const start = now + startOffset;
        gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      };

      if (mode === "sortie") {
        // Sortie: bip simple aigu.
        playTone(880, 0, 0.15);
      } else {
        // Retour: double bip plus grave/puis aigu.
        playTone(660, 0, 0.1);
        playTone(990, 0.12, 0.1);
      }
    } catch {
      // Ignore audio errors: sound feedback is optional.
    }
  }

  function playErrorBeep() {
    if (!soundEnabled) {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      const now = ctx.currentTime;

      const playTone = (frequency: number, startOffset: number, duration: number) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "triangle";
        oscillator.frequency.value = frequency;
        gain.gain.value = 0.0001;

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        const start = now + startOffset;
        gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.start(start);
        oscillator.stop(start + duration + 0.01);
      };

      // Erreur: double bip descendant.
      playTone(520, 0, 0.12);
      playTone(330, 0.14, 0.14);
    } catch {
      // Ignore audio errors: sound feedback is optional.
    }
  }

  function setFieldValue(id: string, value: string) {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) {
      el.value = value;
    }
  }

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SOUND_ENABLED_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      showToast(next ? "Son activé" : "Son désactivé", "default");
      return next;
    });
  }

  function resetArticleForm() {
    setFieldValue("art-id", "");
    setFieldValue("art-nom", "");
    setFieldValue("art-ref", "");
    setFieldValue("art-cat", "Mobilier");
    setFieldValue("art-qty", "0");
    setFieldValue("art-val", "0");
    setFieldValue("art-seuil", "5");
    setFieldValue("art-emoji", "📦");
    setFieldValue("art-notes", "");
  }

  function resetEventForm() {
    setFieldValue("ev-id", "");
    setFieldValue("ev-nom", "");
    setFieldValue("ev-client", "");
    setFieldValue("ev-debut", "");
    setFieldValue("ev-fin", "");
    setFieldValue("ev-lieu", "");
    setFieldValue("ev-resp", state.currentUser);
    setFieldValue("ev-statut", "Planifié");
    setFieldValue("ev-notes", "");
  }

  function resetUserForm() {
    setFieldValue("usr-id", "");
    setFieldValue("usr-username", "");
    setFieldValue("usr-prenom", "");
    setFieldValue("usr-nom", "");
    setFieldValue("usr-email", "");
    setFieldValue("usr-role", "Administrateur");
    setFieldValue("usr-password", "");
    setFieldValue("usr-password-confirm", "");
    setFieldValue("usr-new-password", "");
    setFieldValue("usr-new-password-confirm", "");
  }

  function openEditArticle(articleId: string) {
    const article = state.articles.find((item) => item.id === articleId);
    if (!article) {
      showToast("Article introuvable", "danger");
      return;
    }
    setFieldValue("art-id", article.id);
    setFieldValue("art-nom", article.nom);
    setFieldValue("art-ref", article.ref);
    setFieldValue("art-cat", article.cat);
    setFieldValue("art-qty", String(article.qtyTotal));
    setFieldValue("art-val", String(article.valUnit));
    setFieldValue("art-seuil", String(article.seuilMin));
    setFieldValue("art-emoji", article.emoji || "📦");
    setFieldValue("art-notes", article.notes || "");
    setArticleModalOpen(true);
  }

  function openEditEvent(eventId: string) {
    const event = state.evenements.find((item) => item.id === eventId);
    if (!event) {
      showToast("Événement introuvable", "danger");
      return;
    }
    setFieldValue("ev-id", event.id);
    setFieldValue("ev-nom", event.nom);
    setFieldValue("ev-client", event.client || "");
    setFieldValue("ev-debut", event.debut);
    setFieldValue("ev-fin", event.fin);
    setFieldValue("ev-lieu", event.lieu || "");
    const ownerIdFromName = state.utilisateurs.find(
      (user) => `${user.prenom} ${user.nom}`.trim() === (event.resp || "").trim(),
    )?.id;
    setFieldValue("ev-resp", ownerIdFromName ?? state.currentUser);
    setFieldValue("ev-statut", event.statut);
    setFieldValue("ev-notes", event.notes || "");
    setEventModalOpen(true);
  }

  function openEditUser(userId: string) {
    const user = state.utilisateurs.find((item) => item.id === userId);
    if (!user) {
      showToast("Utilisateur introuvable", "danger");
      return;
    }
    setUserModalMode("edit");
    setFieldValue("usr-id", user.id);
    setFieldValue("usr-username", user.username?.trim() || "");
    setFieldValue("usr-prenom", user.prenom);
    setFieldValue("usr-nom", user.nom);
    setFieldValue("usr-email", user.email);
    setFieldValue("usr-role", user.role);
    setFieldValue("usr-new-password", "");
    setFieldValue("usr-new-password-confirm", "");
    setUserModalOpen(true);
  }

  function askConfirm(options: { title: string; message: string; label?: string; onConfirm: () => void }) {
    setConfirmTitle(options.title);
    setConfirmMessage(options.message);
    setConfirmLabel(options.label ?? "Confirmer");
    confirmCallbackRef.current = options.onConfirm;
    setConfirmModalOpen(true);
  }

  function parseCsvLine(line: string) {
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        const next = line[i + 1];
        if (inQuotes && next === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  }

  function importCatalogueCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      const lines = content
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length <= 1) {
        showToast("CSV vide ou invalide", "danger");
        return;
      }

      const rows = lines.slice(1).map(parseCsvLine);
      void (async () => {
        const payload: Array<{
          nom: string;
          ref: string;
          cat: string;
          qtyTotal: number;
          valUnit: number;
          seuilMin: number;
        }> = [];
        for (const row of rows) {
          const [
            reference = "",
            designation = "",
            category = "Autre",
            qtyTotal = "0",
            ,
            ,
            unitValue = "0",
            minThreshold = "5",
          ] = row;
          if (!designation.trim()) {
            continue;
          }
          payload.push({
            nom: designation.trim(),
            ref: reference.trim(),
            cat: category.trim() || "Autre",
            qtyTotal: Number.parseInt(qtyTotal, 10) || 0,
            valUnit: Number.parseFloat(unitValue) || 0,
            seuilMin: Number.parseInt(minThreshold, 10) || 5,
          });
        }
        const { count } = await importCatalogueRowsViaApi(payload);
        await refreshStateFromApi();
        showToast(`${count} article(s) importé(s)`, "ok");
      })().catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : "Import impossible", "danger");
      });
    };
    reader.readAsText(file, "utf-8");
  }

  function formatDateRange(start: string, end: string) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    const toLabel = (value: Date | null) =>
      value
        ? value.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
        : "—";
    if (!startDate && !endDate) {
      return "—";
    }
    if (!endDate || (startDate && startDate.toDateString() === endDate.toDateString())) {
      return toLabel(startDate);
    }
    return `${toLabel(startDate)} → ${toLabel(endDate)}`;
  }

  const printBaseStyles = `
    @import url("https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Epilogue:wght@400;500;600&display=swap");
    :root{
      --navy:#0d1f35;--navy2:#152d4a;--gold:#c8883a;--gold2:#e0a24f;--ok:#0f7a52;--warn:#9a5c0a;
      --bg:#f4f6fa;--surface:#ffffff;--surface2:#f0f3f8;--text:#0d1f35;--text2:#3a4a60;--text3:#7a8fa8;
      --border:#dde4ef;--r8:8px;--r12:12px;--r999:999px;--font:'Epilogue',sans-serif;--font-display:'Syne',sans-serif;
    }
    *{box-sizing:border-box}
    body{margin:0;padding:28px;background:var(--bg);font-family:var(--font);color:var(--text)}
    .sheet{max-width:980px;margin:0 auto;background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);padding:22px;box-shadow:0 4px 16px rgba(13,31,53,.1)}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
    h1{margin:0;font-family:var(--font-display);font-size:24px;letter-spacing:-.4px}
    .sub{font-size:13px;color:var(--text3);margin-top:4px}
    .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:var(--r8);border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:12px;font-weight:600;cursor:pointer}
    .btn:hover{border-color:#c5d0e2}
    @media print{body{padding:0;background:#fff}.sheet{border:none;box-shadow:none}}
  `;

  function generatePackingList(eventId: string) {
    const event = state.evenements.find((item) => item.id === eventId);
    if (!event) {
      showToast("Événement introuvable", "danger");
      return;
    }
    const outbound = state.mouvements.filter((movement) => movement.evId === eventId && movement.type === "Sortie");
    const grouped = new Map<string, number>();
    outbound.forEach((movement) => {
      grouped.set(movement.articleId, (grouped.get(movement.articleId) ?? 0) + movement.qty);
    });
    const rows = Array.from(grouped.entries())
      .map(([articleId, qty]) => {
        const article = state.articles.find((item) => item.id === articleId);
        return {
          name: article?.nom ?? "Article supprimé",
          ref: article?.ref ?? "—",
          emoji: article?.emoji ?? "📦",
          qty,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!popup) {
      showToast("Impossible d’ouvrir la fenêtre d’impression", "danger");
      return;
    }
    popup.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Packing List — ${event.nom}</title>
  <style>
    ${printBaseStyles}
    .top{margin-bottom:16px}
    .sub{color:var(--text2)}
    .meta{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:10px 14px;margin:14px 0 18px}
    .pill{background:rgba(200,136,58,.12);border:1px solid rgba(200,136,58,.3);border-radius:var(--r999);padding:7px 11px;font-size:12px}
    .pill strong{font-family:var(--font-display);font-size:11px;margin-right:6px;color:var(--navy2)}
    table{width:100%;border-collapse:collapse}
    th{font-family:var(--font-display);font-size:9px;text-transform:uppercase;letter-spacing:.4px;background:var(--surface2);color:var(--text2)}
    th,td{border:1px solid var(--border);padding:8px 10px;text-align:left}
    td{font-size:11px}
    .qty{font-family:var(--font-display);font-size:18px;color:var(--navy2)}
    .empty{color:#7a8fa8;text-align:center;padding:16px}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1>📦 Packing List</h1>
        <div class="sub">Checklist logistique exportée depuis StockEvent Pro</div>
      </div>
      <button class="btn" onclick="window.print()">🖨 Imprimer</button>
    </div>
    <div class="meta">
      <div class="pill"><strong>Événement</strong> ${event.nom}</div>
      <div class="pill"><strong>Client</strong> ${event.client || "—"}</div>
      <div class="pill"><strong>Période</strong> ${formatDateRange(event.debut, event.fin)}</div>
      <div class="pill"><strong>Lieu</strong> ${event.lieu || "—"}</div>
    </div>
    <table>
      <thead>
        <tr><th>Article</th><th>Référence</th><th>Quantité</th><th>✅ Chargé</th></tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows
                .map(
                  (row) =>
                    `<tr><td>${row.emoji} ${row.name}</td><td>${row.ref}</td><td class="qty">${row.qty}</td><td>☐</td></tr>`,
                )
                .join("")
            : '<tr><td class="empty" colspan="4">Aucun article affecté.</td></tr>'
        }
      </tbody>
    </table>
  </div>
</body>
</html>`);
    popup.document.close();
  }

  function printReportRich() {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!popup) {
      showToast("Impossible d’ouvrir la fenêtre d’impression", "danger");
      return;
    }
    const sorties = state.mouvements.filter((movement) => movement.type === "Sortie").reduce((sum, m) => sum + m.qty, 0);
    const retours = state.mouvements.filter((movement) => movement.type === "Retour").reduce((sum, m) => sum + m.qty, 0);
    const pertes = state.mouvements
      .filter((movement) => movement.etat === "Perdu" || movement.etat === "Endommagé")
      .reduce((sum, m) => sum + m.qty, 0);
    const valeur = state.articles.reduce((sum, article) => sum + article.qtyTotal * article.valUnit, 0);
    popup.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport StockEvent</title>
  <style>
    ${printBaseStyles}
    .top{margin-bottom:12px}
    .kpi{display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:12px;margin:16px 0}
    .card{border:1px solid var(--border);border-radius:var(--r12);padding:14px;background:var(--surface2)}
    .label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);font-family:var(--font-display)}
    .value{font-size:28px;font-weight:700;font-family:var(--font-display);color:var(--navy2);margin-top:6px}
    .v-ok{color:var(--ok)} .v-warn{color:var(--warn)} .v-gold{color:var(--gold)}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1>Rapport StockEvent Pro</h1>
        <div class="sub">Généré le ${new Date().toLocaleString("fr-FR")}</div>
      </div>
      <button class="btn" onclick="window.print()">🖨 Imprimer</button>
    </div>
    <div class="kpi">
      <div class="card"><div class="label">Total sorties</div><div class="value">${sorties}</div></div>
      <div class="card"><div class="label">Total retours</div><div class="value v-ok">${retours}</div></div>
      <div class="card"><div class="label">Pertes / dommages</div><div class="value v-warn">${pertes}</div></div>
      <div class="card"><div class="label">Valeur stock (F CFA)</div><div class="value v-gold">${valeur.toLocaleString("fr-FR")}</div></div>
    </div>
  </div>
</body>
</html>`);
    popup.document.close();
  }

  if (!clientReady || !sessionReady) {
    return <div className="app-client-loading">Chargement…</div>;
  }

  const canManageUsers =
    state.utilisateurs.find((user) => user.id === state.currentUser)?.role === "Administrateur";
  const canManageCategories = currentUser.role !== "Lecture seule";

  function openCategoryModal(mode: "create" | "edit", row?: CategoryWithCount) {
    setCategoryModalMode(mode);
    setCategoryEditing(row ?? null);
    setCategoryModalOpen(true);
  }

  async function submitCategory(payload: { id?: string; name: string; slug: string }) {
    if (payload.id) {
      await updateCategoryViaApi(payload.id, { name: payload.name, slug: payload.slug });
    } else {
      await createCategoryViaApi({ name: payload.name, slug: payload.slug });
    }
    setCategoryModalOpen(false);
    await refreshStateFromApi();
    setCategoriesReloadToken((t) => t + 1);
    showToast("Catégorie enregistrée", "ok");
  }

  function requestDeleteCategory(row: CategoryWithCount) {
    if (row.itemCount > 0) {
      showToast("Impossible : cette catégorie contient encore des articles.", "danger");
      return;
    }
    askConfirm({
      title: "Supprimer la catégorie",
      message: `Supprimer « ${row.name} » ?`,
      label: "Supprimer",
      onConfirm: async () => {
        try {
          await deleteCategoryViaApi(row.id);
          await refreshStateFromApi();
          setCategoriesReloadToken((t) => t + 1);
          showToast("Catégorie supprimée", "ok");
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Action impossible", "danger");
        }
      },
    });
  }

  return (
    <div id="app">
      <Topbar
        userInitials={currentUser.initials}
        userFullName={currentUser.fullName}
        userAvatarUrl={currentUser.avatarUrl}
        onOpenAlerts={() => setActivePage("alertes")}
        onOpenProfile={() => setActivePage("profil")}
        onSearchChange={runGlobalSearch}
      />
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        catalogueCount={appCounts.catalogue}
        evenementsCount={appCounts.evenements}
        alertesCount={appCounts.alertes}
        userInitials={currentUser.initials}
        userFullName={currentUser.fullName}
        userAvatarUrl={currentUser.avatarUrl}
        userRoleLabel={currentUser.role}
      />
      <MainContent
        activePage={activePage}
        state={state}
        onNavigate={setActivePage}
        onOpenArticleModal={() => {
          resetArticleForm();
          setArticleModalOpen(true);
        }}
        onOpenEventModal={() => {
          resetEventForm();
          setEventModalOpen(true);
        }}
        onOpenAffectModal={() => {
          setAffectModalOpen(true);
        }}
        onOpenSortieModal={() => {
          setSortieModalOpen(true);
        }}
        onOpenRetourModal={() => {
          setRetourModalOpen(true);
        }}
        onOpenUserModal={() => {
          resetUserForm();
          setUserModalMode("create");
          setUserModalOpen(true);
        }}
        canManageUsers={canManageUsers}
        canManageCategories={canManageCategories}
        categoriesReloadToken={categoriesReloadToken}
        onOpenCategoryModal={openCategoryModal}
        onRequestDeleteCategory={requestDeleteCategory}
        onEditArticle={openEditArticle}
        onEditEvent={openEditEvent}
        onEditUser={openEditUser}
        onDeleteArticle={(articleId) => {
          askConfirm({
            title: "Supprimer l'article",
            message: "Cette action est irréversible. Voulez-vous continuer ?",
            label: "Supprimer",
            onConfirm: async () => {
              try {
                const message = await deleteArticleViaApi(articleId);
                await refreshStateFromApi();
                showToast(message, "ok");
              } catch (error) {
                showToast(error instanceof Error ? error.message : "Action impossible", "danger");
              }
            },
          });
        }}
        onDeleteEvent={(eventId) => {
          askConfirm({
            title: "Supprimer l'événement",
            message: "Les affectations liées seront aussi impactées. Continuer ?",
            label: "Supprimer",
            onConfirm: async () => {
              try {
                const message = await deleteEventViaApi(eventId);
                await refreshStateFromApi();
                showToast(message, "ok");
              } catch (error) {
                showToast(error instanceof Error ? error.message : "Action impossible", "danger");
              }
            },
          });
        }}
        onDeleteUser={(userId) => {
          askConfirm({
            title: "Supprimer l'utilisateur",
            message: "Voulez-vous vraiment supprimer cet utilisateur ?",
            label: "Supprimer",
            onConfirm: async () => {
              try {
                const message = await deleteUserViaApi(userId);
                await refreshStateFromApi();
                showToast(message, "ok");
              } catch (error) {
                showToast(error instanceof Error ? error.message : "Action impossible", "danger");
              }
            },
          });
        }}
        onScanSortie={({ ref, qty, eventId }) => {
          void (async () => {
            try {
              const article = state.articles.find((item) => item.ref.toLowerCase() === ref.trim().toLowerCase());
              if (!article) {
                showToast("Référence article introuvable", "danger");
                playErrorBeep();
                return;
              }
              const message = await saveSortieViaApi({
                artId: article.id,
                qty,
                evId: eventId,
                note: "Scan rapide",
              });
              await refreshStateFromApi();
              showToast(message, "ok");
              playSuccessBeep("sortie");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Action impossible", "danger");
              playErrorBeep();
            }
          })();
        }}
        onScanRetour={({ ref, qty, eventId }) => {
          void (async () => {
            try {
              const article = state.articles.find((item) => item.ref.toLowerCase() === ref.trim().toLowerCase());
              if (!article) {
                showToast("Référence article introuvable", "danger");
                playErrorBeep();
                return;
              }
              const message = await saveRetourViaApi({
                artId: article.id,
                qty,
                evId: eventId,
                etat: "Bon état",
                note: "Scan rapide",
              });
              await refreshStateFromApi();
              showToast(message, "ok");
              playSuccessBeep("retour");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Action impossible", "danger");
              playErrorBeep();
            }
          })();
        }}
        onImportCsv={importCatalogueCsv}
        onRefreshAlerts={() => {
          void refreshStateFromApi()
            .then(() => {
              showToast("Alertes actualisées", "ok");
            })
            .catch((error: unknown) => {
              showToast(error instanceof Error ? error.message : "Actualisation impossible", "danger");
            });
        }}
        onOrderArticle={(articleId) => {
          const article = state.articles.find((item) => item.id === articleId);
          if (!article) {
            showToast("Article introuvable", "danger");
            return;
          }
          setActivePage("catalogue");
          openEditArticle(article.id);
          showToast(`Préparation de commande pour ${article.nom}`, "ok");
        }}
        onGeneratePackingList={generatePackingList}
        onPrintReport={printReportRich}
        onSaveProfile={({ prenom, nom, email, avatarUrl, currentPassword, newPassword }) => {
          void (async () => {
            const profile = state.utilisateurs.find((user) => user.id === state.currentUser);
            if (!profile) {
              showToast("Profil introuvable", "danger");
              return;
            }
            try {
              const message = await saveProfileViaApi({
                prenom,
                nom,
                email,
                avatarUrl,
                currentPassword,
                newPassword,
              });
              await refreshStateFromApi();
              showToast(message, "ok");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Action impossible", "danger");
            }
          })();
        }}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />
      <ModalCategory
        isOpen={categoryModalOpen}
        mode={categoryModalMode}
        initial={
          categoryEditing
            ? { id: categoryEditing.id, name: categoryEditing.name, slug: categoryEditing.slug }
            : null
        }
        onClose={() => setCategoryModalOpen(false)}
        onSubmit={async (payload) => {
          try {
            await submitCategory(payload);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalArticle
        isOpen={articleModalOpen}
        onClose={() => setArticleModalOpen(false)}
        categories={articleCategories}
        onSave={async () => {
          try {
            const message = await saveArticleViaApi({
              id: getInputValue("art-id") || undefined,
              nom: getInputValue("art-nom"),
              ref: getInputValue("art-ref"),
              cat: getSelectValue("art-cat"),
              qtyTotal: Number.parseInt(getInputValue("art-qty"), 10) || 0,
              valUnit: Number.parseFloat(getInputValue("art-val")) || 0,
              seuilMin: Number.parseInt(getInputValue("art-seuil"), 10) || 5,
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setArticleModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalEvent
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onSave={async () => {
          try {
            const ownerId = getSelectValue("ev-resp");
            const message = await saveEventViaApi({
              id: getInputValue("ev-id") || undefined,
              nom: getInputValue("ev-nom"),
              client: getInputValue("ev-client"),
              debut: getInputValue("ev-debut"),
              fin: getInputValue("ev-fin"),
              lieu: getInputValue("ev-lieu"),
              ownerId: ownerId || state.currentUser,
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setEventModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalAffect
        isOpen={affectModalOpen}
        onClose={() => setAffectModalOpen(false)}
        onSave={async () => {
          try {
            const message = await saveAffectationViaApi({
              evId: getInputValue("affect-ev-id"),
              artId: getSelectValue("affect-article"),
              qty: Number.parseInt(getInputValue("affect-qty"), 10) || 1,
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setAffectModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalSortie
        isOpen={sortieModalOpen}
        onClose={() => setSortieModalOpen(false)}
        onSave={async () => {
          try {
            const message = await saveSortieViaApi({
              artId: getSelectValue("sortie-article"),
              qty: Number.parseInt(getInputValue("sortie-qty"), 10) || 1,
              evId: getSelectValue("sortie-event"),
              note: getInputValue("sortie-note"),
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setSortieModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalRetour
        isOpen={retourModalOpen}
        onClose={() => setRetourModalOpen(false)}
        onSave={async () => {
          try {
            const message = await saveRetourViaApi({
              artId: getSelectValue("retour-article"),
              qty: Number.parseInt(getInputValue("retour-qty"), 10) || 1,
              evId: getSelectValue("retour-event"),
              etat: (getSelectValue("retour-etat") || "Bon état") as ReturnCondition,
              note: getInputValue("retour-note"),
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setRetourModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalUser
        isOpen={userModalOpen}
        mode={userModalMode}
        onClose={() => setUserModalOpen(false)}
        onSave={async () => {
          try {
            const username = getInputValue("usr-username").trim().toLowerCase();
            if (username.length < 2) {
              showToast("Le nom d’utilisateur doit contenir au moins 2 caractères.", "danger");
              return;
            }
            if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
              showToast(
                "Nom d’utilisateur : lettres, chiffres, point, tiret ou underscore uniquement.",
                "danger",
              );
              return;
            }
            const id = getInputValue("usr-id") || undefined;
            const prenom = getInputValue("usr-prenom");
            const nom = getInputValue("usr-nom");
            const email = getInputValue("usr-email");
            const role = (getSelectValue("usr-role") || "Administrateur") as Role;

            if (!id) {
              const password = getInputValue("usr-password");
              const passwordConfirm = getInputValue("usr-password-confirm");
              if (password.length < 8) {
                showToast("Le mot de passe doit contenir au moins 8 caractères.", "danger");
                return;
              }
              if (password !== passwordConfirm) {
                showToast("Les mots de passe ne correspondent pas.", "danger");
                return;
              }
              const message = await saveUserViaApi({
                username,
                prenom,
                nom,
                email,
                role,
                password,
              });
              await refreshStateFromApi();
              showToast(message, "ok");
              setUserModalOpen(false);
              return;
            }

            const newPw = getInputValue("usr-new-password");
            const newPwConfirm = getInputValue("usr-new-password-confirm");
            if (newPw || newPwConfirm) {
              if (newPw.length < 8) {
                showToast("Le nouveau mot de passe doit contenir au moins 8 caractères.", "danger");
                return;
              }
              if (newPw !== newPwConfirm) {
                showToast("Les nouveaux mots de passe ne correspondent pas.", "danger");
                return;
              }
            }
            const message = await saveUserViaApi({
              id,
              username,
              prenom,
              nom,
              email,
              role,
              newPassword: newPw.length > 0 ? newPw : undefined,
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setUserModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalConfirm
        isOpen={confirmModalOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => {
          setConfirmModalOpen(false);
          confirmCallbackRef.current?.();
          confirmCallbackRef.current = null;
        }}
      />
      <Toast message={toast.message} visible={toast.visible} type={toast.type} />
    </div>
  );
}
