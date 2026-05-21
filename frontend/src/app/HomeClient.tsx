"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MainContent } from "@/components/MainContent";
import { ModalAffect } from "@/components/ModalAffect";
import { ModalArticle } from "@/components/ModalArticle";
import { ModalConfirm } from "@/components/ModalConfirm";
import { ModalEvent } from "@/components/ModalEvent";
import { ModalStockMovement } from "@/components/ModalStockMovement";
import { stashCdcBonsFlow, type CdcBonsFlowIntent } from "@/lib/cdc-bons-navigation";
import { ModalCategory } from "@/components/ModalCategory";
import { ModalWarehouse } from "@/components/ModalWarehouse";
import { ModalWarehouseZones } from "@/components/ModalWarehouseZones";
import { ModalUser } from "@/components/ModalUser";
import { Sidebar, type PageId } from "@/components/Sidebar";
import { isCdcModulePage } from "@/lib/cdc-modules";
import { Topbar } from "@/components/Topbar";
import type { MovementUiType } from "@/lib/movement-helpers";
import {
  createCategoryViaApi,
  deleteArticleViaApi,
  deleteCategoryViaApi,
  fetchCategoriesWithCounts,
  deleteEventViaApi,
  deleteUserViaApi,
  fetchAuthMe,
  fetchMovementLocationOptions,
  importCatalogueRowsViaApi,
  loadStateFromBackend,
  getApiOriginForDisplay,
  saveAffectationViaApi,
  saveArticleViaApi,
  saveEventViaApi,
  saveMovementViaApi,
  saveRetourViaApi,
  saveSortieViaApi,
  toggleCategoryActiveViaApi,
  toggleUserActiveViaApi,
  searchViaApi,
  saveUserViaApi,
  saveProfileViaApi,
  updateCategoryViaApi,
  deleteWarehouseViaApi,
  deleteStorageZoneViaApi,
  deleteShelvingNodeViaApi,
  deleteStorageLocationViaApi,
  saveWarehouseViaApi,
  toggleWarehouseActiveViaApi,
  type CategoryFormPayload,
  type CategoryParentPreset,
  type CategoryWithCount,
  type ShelvingNodeRow,
  type StorageLocationRow,
  type StorageZoneRow,
  type WarehouseFormPayload,
  type WarehouseRow,
} from "@/lib/stock/api";
import { getInputValue, getSelectValue } from "@/lib/stock/dom";
import {
  buildAffectArticleOptions,
  buildArticleOptions,
  buildArticleSelectOptions,
  buildEventOptions,
  buildEventSelectOptions,
  buildUserOptions,
} from "@/lib/stock/modalOptions";
import { categoryPathLabel, leafCategories } from "@/lib/category-tree";
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
import type { Article, EventStatus, ReturnCondition, Role, StockState } from "@/lib/stock/types";
import { ToastProvider, useToast } from "@/lib/stock/useToast";

const SOUND_ENABLED_KEY = "stockevent_sound_enabled";
const THEME_MODE_KEY = "stockevent_theme_mode";
const DEFAULT_CATEGORIES = [
  "Mobilier",
  "Audiovisuel",
  "Vaisselle",
  "Décoration",
  "Textile",
  "Éclairage",
  "Autre",
];

function HomeApp() {
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

  const navigateToPage = useCallback((page: PageId) => {
    setActivePage(page);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (page === "dashboard") {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", page);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  }, []);

  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [articleEditing, setArticleEditing] = useState<Article | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [affectModalOpen, setAffectModalOpen] = useState(false);
  const [affectPreset, setAffectPreset] = useState<{ evId: string; evName: string } | null>(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementPreset, setMovementPreset] = useState<MovementUiType>("Entrée");
  const [movementLocations, setMovementLocations] = useState<Array<{ id: string; label: string }>>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<"create" | "edit">("create");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<"create" | "edit">("create");
  const [categoryEditing, setCategoryEditing] = useState<CategoryWithCount | null>(null);
  const [categoryParentPreset, setCategoryParentPreset] = useState<CategoryParentPreset | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryWithCount[]>([]);
  const [categoriesReloadToken, setCategoriesReloadToken] = useState(0);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [warehouseModalMode, setWarehouseModalMode] = useState<"create" | "edit">("create");
  const [warehouseEditing, setWarehouseEditing] = useState<WarehouseRow | null>(null);
  const [warehousesReloadToken, setWarehousesReloadToken] = useState(0);
  const [warehouseZonesOpen, setWarehouseZonesOpen] = useState(false);
  const [warehouseForZones, setWarehouseForZones] = useState<WarehouseRow | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("Confirmer");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmLabel, setConfirmLabel] = useState("Supprimer");
  const { showToast } = useToast();
  const confirmCallbackRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  const appCounts = useMemo(() => counts(state), [state]);
  const currentUser = useMemo(() => currentUserDisplay(state), [state]);
  const userOptions = useMemo(() => buildUserOptions(state), [state]);
  const affectArticleOptions = useMemo(() => buildAffectArticleOptions(state), [state]);
  const articleOptions = useMemo(() => buildArticleOptions(state), [state]);
  const articleSelectOptions = useMemo(() => buildArticleSelectOptions(state), [state]);
  const eventSelectOptions = useMemo(() => buildEventSelectOptions(state, true), [state]);
  const eventOptions = useMemo(() => buildEventOptions(state, true), [state]);

  const refreshCategoryOptions = useCallback(async () => {
    try {
      const rows = await fetchCategoriesWithCounts();
      setCategoryOptions(rows);
    } catch {
      setCategoryOptions([]);
    }
  }, []);

  const articleCategories = useMemo(() => {
    if (categoryOptions.length > 0) {
      const leaves = leafCategories(categoryOptions);
      return leaves
        .map((row) => categoryPathLabel(categoryOptions, row.id))
        .sort((a, b) => a.localeCompare(b, "fr"));
    }
    const fromArticles = state.articles.map((article) => article.cat).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromArticles]));
  }, [categoryOptions, state.articles]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    void refreshCategoryOptions();
  }, [sessionReady, categoriesReloadToken, refreshCategoryOptions]);

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
          `Aucune donnée côté API. Exécutez une fois : POST ${getApiOriginForDisplay()}/api/setup/seed (corps vide). En production : header Authorization Bearer {SEED_SECRET}. Puis rechargez. Vérifiez MongoDB et « npx prisma db push » (dossier frontend).`,
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
    if (!clientReady) return;
    const page = new URLSearchParams(window.location.search).get("page");
    if (!page) return;
    if (isCdcModulePage(page) || page === "profil") {
      setActivePage(page as PageId);
    }
  }, [clientReady]);

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
    try {
      const raw = window.localStorage.getItem(THEME_MODE_KEY);
      if (raw === "dark" || raw === "light") {
        setThemeMode(raw);
        return;
      }
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setThemeMode("dark");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme", themeMode);
    try {
      window.localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {
      // ignore storage errors
    }
  }, [themeMode]);

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
    const hidden = document.getElementById("affect-ev-id") as HTMLInputElement | null;
    const nameEl = document.getElementById("affect-ev-name");
    const picker = document.getElementById("affect-ev-picker");
    const eventSelect = document.getElementById("affect-ev-select") as HTMLSelectElement | null;
    if (affectPreset?.evId) {
      if (hidden) {
        hidden.value = affectPreset.evId;
      }
      if (nameEl) {
        nameEl.textContent = affectPreset.evName;
        nameEl.style.display = "";
      }
      if (picker) {
        picker.style.display = "none";
      }
    } else {
      if (hidden) {
        hidden.value = "";
      }
      if (nameEl) {
        nameEl.style.display = "none";
      }
      if (picker) {
        picker.style.display = "";
      }
      if (eventSelect) {
        const options = state.evenements
          .filter((event) => event.statut !== "Terminé" && event.statut !== "Annulé")
          .map((event) => `<option value="${event.id}">${event.nom}</option>`)
          .join("");
        eventSelect.innerHTML = `<option value="">— Sélectionner un événement —</option>${options}`;
        eventSelect.onchange = () => {
          if (hidden) {
            hidden.value = eventSelect.value;
          }
        };
      }
    }
  }, [affectModalOpen, affectArticleOptions, affectPreset, state.evenements]);

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
      navigateToPage(localResult.page);
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
          navigateToPage(first.page);
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

  function toggleTheme() {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
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
    setArticleEditing(article);
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

  function openAffectModal(eventId?: string, eventName?: string) {
    if (eventId) {
      const name =
        eventName ?? state.evenements.find((event) => event.id === eventId)?.nom ?? "Événement";
      setAffectPreset({ evId: eventId, evName: name });
    } else {
      setAffectPreset(null);
    }
    setAffectModalOpen(true);
  }

  function openCdcBonsFlow(intent: CdcBonsFlowIntent) {
    stashCdcBonsFlow(intent);
    navigateToPage("bons");
  }

  function openCdcBonsWizard(preset: Omit<CdcBonsFlowIntent, "openWizard">) {
    openCdcBonsFlow({ ...preset, openWizard: true });
    showToast(
      "Utilisez l’assistant bon (BE / BS / BT) : tout mouvement physique doit être documenté et signé.",
      "default",
    );
  }

  /** Legacy — correction d’écart uniquement ; les flux métier passent par les bons CDC. */
  function openMovementModal(preset: MovementUiType = "Entrée") {
    setMovementPreset(preset);
    setMovementModalOpen(true);
    void fetchMovementLocationOptions()
      .then(setMovementLocations)
      .catch(() => setMovementLocations([]));
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
    th{font-family:var(--font-display);font-size:9px;text-transform:uppercase;letter-spacing:.38px;background:var(--surface2);color:var(--text2)}
    th,td{border:1px solid var(--border);padding:7px 9px;text-align:left}
    td{font-size:10px}
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
  const isReadOnlyUser =
    currentUser.role === "Utilisateur lambda" || currentUser.role === "Lecture seule";
  const canManageCategories = !isReadOnlyUser;
  const canManageWarehouses = !isReadOnlyUser;

  function openCategoryModal(
    mode: "create" | "edit",
    row?: CategoryWithCount,
    parentPreset?: CategoryParentPreset,
  ) {
    setCategoryModalMode(mode);
    setCategoryEditing(row ?? null);
    setCategoryParentPreset(parentPreset ?? null);
    setCategoryModalOpen(true);
    void refreshCategoryOptions();
  }

  async function submitCategory(payload: CategoryFormPayload) {
    const { id, ...body } = payload;
    if (id) {
      await updateCategoryViaApi(id, body);
    } else {
      await createCategoryViaApi(body);
    }
    setCategoryModalOpen(false);
    setCategoryParentPreset(null);
    await refreshStateFromApi();
    setCategoriesReloadToken((t) => t + 1);
    showToast("Catégorie enregistrée", "ok");
  }

  function openWarehouseModal(mode: "create" | "edit", row?: WarehouseRow) {
    setWarehouseModalMode(mode);
    setWarehouseEditing(row ?? null);
    setWarehouseModalOpen(true);
  }

  function openWarehouseZones(row: WarehouseRow) {
    setWarehouseForZones(row);
    setWarehouseZonesOpen(true);
  }

  function requestDeleteStorageZone(zone: StorageZoneRow) {
    if (!warehouseForZones) {
      return;
    }
    askConfirm({
      title: "Supprimer la zone",
      message: `Supprimer la zone « ${zone.name} » (${zone.code}) ?`,
      label: "Supprimer",
      onConfirm: async () => {
        try {
          await deleteStorageZoneViaApi(warehouseForZones.id, zone.id);
          setWarehousesReloadToken((t) => t + 1);
          showToast("Zone supprimée", "ok");
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Action impossible", "danger");
        }
      },
    });
  }

  function requestDeleteShelvingNode(zone: StorageZoneRow, node: ShelvingNodeRow) {
    if (!warehouseForZones) {
      return;
    }
    askConfirm({
      title: "Supprimer l'élément",
      message: `Supprimer « ${node.coordinate} » (${node.levelLabel}) ?`,
      label: "Supprimer",
      onConfirm: async () => {
        try {
          await deleteShelvingNodeViaApi(warehouseForZones.id, zone.id, node.id);
          setWarehousesReloadToken((t) => t + 1);
          showToast("Élément supprimé", "ok");
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Action impossible", "danger");
        }
      },
    });
  }

  function requestDeleteStorageLocation(zone: StorageZoneRow, location: StorageLocationRow) {
    if (!warehouseForZones) {
      return;
    }
    askConfirm({
      title: "Supprimer l'emplacement",
      message: `Supprimer l'emplacement « ${location.code} » ?`,
      label: "Supprimer",
      onConfirm: async () => {
        try {
          await deleteStorageLocationViaApi(warehouseForZones.id, zone.id, location.id);
          setWarehousesReloadToken((t) => t + 1);
          showToast("Emplacement supprimé", "ok");
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Action impossible", "danger");
        }
      },
    });
  }

  function requestDeleteWarehouse(row: WarehouseRow) {
    askConfirm({
      title: "Supprimer le site",
      message: `Supprimer « ${row.name} » ?`,
      label: "Supprimer",
      onConfirm: async () => {
        try {
          await deleteWarehouseViaApi(row.id);
          setWarehousesReloadToken((t) => t + 1);
          showToast("Site supprimé", "ok");
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Action impossible", "danger");
        }
      },
    });
  }

  function requestDeleteCategory(row: CategoryWithCount) {
    if (row.itemCount > 0) {
      showToast("Impossible : cette catégorie contient encore des articles.", "danger");
      return;
    }
    if (row.childrenCount > 0) {
      showToast("Supprimez d’abord les sous-catégories.", "danger");
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
        onOpenAlerts={() => navigateToPage("alertes")}
        onOpenProfile={() => navigateToPage("profil")}
        onOpenSettings={() => navigateToPage("parametres")}
        onSearchChange={runGlobalSearch}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />
      <Sidebar
        activePage={activePage}
        onNavigate={navigateToPage}
        alertesCount={appCounts.alertes}
        userInitials={currentUser.initials}
        userFullName={currentUser.fullName}
        userAvatarUrl={currentUser.avatarUrl}
        userRoleLabel={currentUser.role}
      />
      <MainContent
        activePage={activePage}
        state={state}
        onNavigate={navigateToPage}
        onOpenArticleModal={() => {
          setArticleEditing(null);
          setArticleModalOpen(true);
        }}
        onOpenEventModal={() => {
          resetEventForm();
          setEventModalOpen(true);
        }}
        onOpenAffectModal={openAffectModal}
        onOpenMovementModal={openMovementModal}
        onOpenCdcSortie={() => openCdcBonsWizard({ kind: "BS", bsSubtype: "BS_EVT" })}
        onOpenCdcReception={() => openCdcBonsWizard({ kind: "BE", beSubtype: "BE_FRN" })}
        onOpenCdcRetour={() => {
          navigateToPage("commandes");
          showToast("Sélectionnez la commande, puis « Démarrer retour » pour générer le BE-RET.", "default");
        }}
        onToggleUserActive={(userId, active) => {
          void (async () => {
            try {
              const message = await toggleUserActiveViaApi(userId, active);
              await refreshStateFromApi();
              showToast(message, "ok");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Action impossible", "danger");
            }
          })();
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
        onToggleCategoryActive={(row, active) => {
          void (async () => {
            try {
              await toggleCategoryActiveViaApi(row.id, active);
              await refreshStateFromApi();
              setCategoriesReloadToken((t) => t + 1);
              showToast(active ? "Catégorie activée" : "Catégorie désactivée", "ok");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Action impossible", "danger");
            }
          })();
        }}
        canManageWarehouses={canManageWarehouses}
        warehousesReloadToken={warehousesReloadToken}
        onOpenWarehouseModal={openWarehouseModal}
        onManageWarehouseZones={openWarehouseZones}
        onRequestDeleteWarehouse={requestDeleteWarehouse}
        onToggleWarehouseActive={(row, active) => {
          void (async () => {
            try {
              await toggleWarehouseActiveViaApi(row.id, active);
              setWarehousesReloadToken((t) => t + 1);
              showToast(active ? "Site activé" : "Site désactivé", "ok");
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Action impossible", "danger");
            }
          })();
        }}
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
          navigateToPage("catalogue");
          openEditArticle(article.id);
          showToast(`Préparation de commande pour ${article.nom}`, "ok");
        }}
        onGeneratePackingList={generatePackingList}
        onPrintReport={printReportRich}
        onRefreshEvents={() => {
          void refreshStateFromApi();
        }}
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
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />
      <ModalWarehouse
        isOpen={warehouseModalOpen}
        mode={warehouseModalMode}
        initial={warehouseEditing}
        onClose={() => {
          setWarehouseModalOpen(false);
          setWarehouseEditing(null);
        }}
        onSubmit={async (payload: WarehouseFormPayload) => {
          try {
            const message = await saveWarehouseViaApi(payload);
            setWarehouseModalOpen(false);
            setWarehouseEditing(null);
            setWarehousesReloadToken((t) => t + 1);
            showToast(message, "ok");
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalWarehouseZones
        isOpen={warehouseZonesOpen}
        warehouse={warehouseForZones}
        canManage={canManageWarehouses}
        onClose={() => {
          setWarehouseZonesOpen(false);
          setWarehouseForZones(null);
        }}
        onZonesChanged={() => setWarehousesReloadToken((t) => t + 1)}
        onRequestDelete={requestDeleteStorageZone}
        onRequestDeleteShelving={requestDeleteShelvingNode}
        onRequestDeleteLocation={requestDeleteStorageLocation}
        shelvingReloadToken={warehousesReloadToken}
        locationsReloadToken={warehousesReloadToken}
      />
      <ModalCategory
        isOpen={categoryModalOpen}
        mode={categoryModalMode}
        initial={categoryEditing}
        parentPreset={categoryParentPreset}
        parentOptions={categoryOptions}
        onClose={() => {
          setCategoryModalOpen(false);
          setCategoryParentPreset(null);
        }}
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
        initial={articleEditing}
        onClose={() => {
          setArticleModalOpen(false);
          setArticleEditing(null);
        }}
        categories={articleCategories}
        onSubmit={async (payload) => {
          try {
            const message = await saveArticleViaApi(payload);
            await refreshStateFromApi();
            showToast(message, "ok");
            setArticleModalOpen(false);
            setArticleEditing(null);
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
              statut: (getSelectValue("ev-statut") || "Planifié") as EventStatus,
              notes: getInputValue("ev-notes"),
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
        onClose={() => {
          setAffectModalOpen(false);
          setAffectPreset(null);
        }}
        onSave={async () => {
          try {
            const evId = getInputValue("affect-ev-id") || getSelectValue("affect-ev-select");
            const message = await saveAffectationViaApi({
              evId,
              artId: getSelectValue("affect-article"),
              qty: Number.parseInt(getInputValue("affect-qty"), 10) || 1,
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setAffectModalOpen(false);
            setAffectPreset(null);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
          }
        }}
      />
      <ModalStockMovement
        isOpen={movementModalOpen}
        preset={movementPreset}
        articleOptions={articleSelectOptions}
        eventOptions={eventSelectOptions}
        locationOptions={movementLocations}
        onClose={() => setMovementModalOpen(false)}
        onSubmit={async (payload) => {
          try {
            const message = await saveMovementViaApi({
              movementType: payload.movementType,
              movementReason: payload.movementReason,
              artId: payload.artId,
              qty: payload.qty,
              evId: payload.evId,
              note: payload.note,
              etat: payload.etat,
              fromLocationId: payload.fromLocationId,
              toLocationId: payload.toLocationId,
              countedQty: payload.countedQty,
              cdcCorrection: payload.cdcCorrection,
              cdcCorrectionNote: payload.cdcCorrectionNote,
            });
            await refreshStateFromApi();
            showToast(message, "ok");
            setMovementModalOpen(false);
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Action impossible", "danger");
            throw error;
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
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeApp />
    </ToastProvider>
  );
}
