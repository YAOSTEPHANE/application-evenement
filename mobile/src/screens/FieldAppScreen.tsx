import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { apiFetch } from "@/lib/api";
import { DOC_KIND_LABELS, ORDER_STATUS_LABELS } from "@/lib/labels";
import {
  addOfflineDraftDocument,
  loadFieldCache,
  saveFieldCache,
  type CachedDocument,
} from "@/lib/offline-cache";
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  getOfflineQueue,
  newOfflineTempDocumentId,
  subscribeOfflineQueue,
} from "@/lib/offline-queue";
import { colors, radius, spacing } from "@/theme";

type DocRow = {
  id: string;
  documentNumber: string;
  kind: string;
  status: string;
};

type AssignmentRow = {
  id: string;
  isTeamLeader: boolean;
  event: {
    id: string;
    name: string;
    location: string;
    clientName: string;
    startsAt: string;
    endsAt: string;
    orderStatus: string;
  };
};

type FieldTab = "scan" | "bon" | "assignments" | "incident";

const TABS: { id: FieldTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "scan", label: "Scan", icon: "scan-outline" },
  { id: "bon", label: "Bon", icon: "document-text-outline" },
  { id: "assignments", label: "Missions", icon: "calendar-outline" },
  { id: "incident", label: "Incident", icon: "warning-outline" },
];

function messageTone(msg: string): "ok" | "err" | "info" {
  const lower = msg.toLowerCase();
  if (lower.includes("échec") || lower.includes("impossible") || lower.includes("sélectionnez")) {
    return "err";
  }
  if (
    lower.includes("enregistré") ||
    lower.includes("signé") ||
    lower.includes("synchronisée") ||
    lower.includes("transmis") ||
    lower.includes("file d'attente")
  ) {
    return "ok";
  }
  return "info";
}

export function FieldAppScreen() {
  const [tab, setTab] = useState<FieldTab>("scan");
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [leaderEvents, setLeaderEvents] = useState<AssignmentRow["event"][]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [portalId, setPortalId] = useState("");
  const [handheldDeviceId, setHandheldDeviceId] = useState("");
  const [portals, setPortals] = useState<Array<{ id: string; code: string; label: string }>>([]);
  const [handhelds, setHandhelds] = useState<Array<{ id: string; code: string; label: string }>>([]);
  const [tags, setTags] = useState("");
  const [online, setOnline] = useState(true);
  const [queueLen, setQueueLen] = useState(0);
  const [message, setMessage] = useState("");
  const [incidentType, setIncidentType] = useState<"LOSS" | "DAMAGE" | "OTHER">("DAMAGE");
  const [incidentEventId, setIncidentEventId] = useState("");
  const [incidentTag, setIncidentTag] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [createEventId, setCreateEventId] = useState("");
  const [createTags, setCreateTags] = useState("");

  const applyCache = useCallback((cache: Awaited<ReturnType<typeof loadFieldCache>>) => {
    if (!cache) return;
    setDocuments(
      cache.documents.filter((d) => d.status !== "SIGNED" && d.status !== "CANCELLED"),
    );
    setAssignments(cache.assignments as AssignmentRow[]);
    setLeaderEvents(cache.leaderEvents);
    setPortals(cache.portals);
    setHandhelds(cache.handhelds);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const net = await NetInfo.fetch();
      const connected = net.isConnected ?? false;
      setOnline(connected);
      setQueueLen((await getOfflineQueue()).length);

      if (!connected) {
        applyCache(await loadFieldCache());
        setMessage("Mode hors ligne — données en cache local.");
        return;
      }

      const [docsRes, assignRes, portalsRes, handheldsRes] = await Promise.all([
        apiFetch("/api/stock-documents"),
        apiFetch("/api/terrain/my-assignments"),
        apiFetch("/api/rfid-portals?active=1"),
        apiFetch("/api/rfid-handhelds?active=1"),
      ]);

      let docs: DocRow[] = [];
      let assignRows: AssignmentRow[] = [];
      let leaders: AssignmentRow["event"][] = [];
      let portalRows: Array<{ id: string; code: string; label: string }> = [];
      let handheldRows: Array<{ id: string; code: string; label: string }> = [];

      if (docsRes.ok) {
        docs = ((await docsRes.json()) as DocRow[]).filter(
          (d) => d.status !== "SIGNED" && d.status !== "CANCELLED",
        );
        setDocuments(docs);
      }
      if (assignRes.ok) {
        const data = (await assignRes.json()) as {
          assignments: AssignmentRow[];
          leaderEvents: AssignmentRow["event"][];
        };
        assignRows = data.assignments ?? [];
        leaders = data.leaderEvents ?? [];
        setAssignments(assignRows);
        setLeaderEvents(leaders);
      }
      if (portalsRes.ok) {
        portalRows = (await portalsRes.json()) as typeof portalRows;
        setPortals(portalRows);
      }
      if (handheldsRes.ok) {
        handheldRows = (await handheldsRes.json()) as typeof handheldRows;
        setHandhelds(handheldRows);
      }

      if (docsRes.ok || assignRes.ok) {
        const cache = await loadFieldCache();
        const offlineDrafts = cache?.documents.filter((d) => d.offline) ?? [];
        await saveFieldCache({
          documents: [...offlineDrafts, ...docs.filter((d) => !offlineDrafts.some((o) => o.id === d.id))],
          assignments: assignRows,
          leaderEvents: leaders,
          portals: portalRows,
          handhelds: handheldRows,
        });
      } else {
        applyCache(await loadFieldCache());
      }
    } catch {
      applyCache(await loadFieldCache());
      setMessage("API inaccessible — cache local utilisé si disponible.");
    }
  }, [applyCache]);

  useEffect(() => {
    void refresh();
    const unsubNet = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setOnline(connected);
      if (connected) {
        void flushOfflineQueue().then((r) => {
          if (r.synced > 0) {
            setMessage(`${r.synced} action(s) synchronisée(s) — aucune perte de file`);
          }
          void refresh();
        });
      }
      void getOfflineQueue().then((q) => setQueueLen(q.length));
    });
    const unsubQueue = subscribeOfflineQueue(() => {
      void getOfflineQueue().then((q) => setQueueLen(q.length));
    });
    return () => {
      unsubNet();
      unsubQueue();
    };
  }, [refresh]);

  const eventOptions = [
    ...assignments.map((a) => a.event),
    ...leaderEvents.filter((e) => !assignments.some((a) => a.event.id === e.id)),
  ];

  async function createBon() {
    if (!createEventId) {
      setMessage("Sélectionnez une commande pour le bon de sortie.");
      return;
    }
    const tagCodes = createTags
      .split(/[\s,;]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tagCodes.length === 0) {
      setMessage("Saisissez au moins un tag RFID.");
      return;
    }
    const payload = { eventId: createEventId, tagCodes, kind: "BS", bsSubtype: "BS_EVT" };

    if (!online) {
      const tempId = newOfflineTempDocumentId();
      const draft: CachedDocument = {
        id: tempId,
        documentNumber: `OFFLINE-${tagCodes.length}L`,
        kind: "BS",
        status: "DRAFT",
        offline: true,
        clientTempId: tempId,
      };
      await addOfflineDraftDocument(draft);
      await enqueueOfflineAction({
        type: "create_document",
        documentId: tempId,
        clientTempId: tempId,
        payload: { ...payload, clientTempId: tempId },
      });
      setDocuments((prev) => [draft, ...prev]);
      setSelectedId(tempId);
      setCreateTags("");
      setMessage("Bon BS-EVT en file — scan et signature possibles hors ligne.");
      setQueueLen((await getOfflineQueue()).length);
      setTab("scan");
      return;
    }

    const res = await apiFetch("/api/terrain/documents", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      id?: string;
      documentNumber?: string;
      kind?: string;
      status?: string;
    };
    if (!res.ok) {
      setMessage(data.message ?? "Échec création du bon");
      return;
    }
    const row: DocRow = {
      id: data.id!,
      documentNumber: data.documentNumber ?? "—",
      kind: data.kind ?? "BS",
      status: data.status ?? "DRAFT",
    };
    setDocuments((prev) => [row, ...prev]);
    setSelectedId(row.id);
    setCreateTags("");
    setMessage(`Bon ${row.documentNumber} créé — vous pouvez scanner.`);
    setTab("scan");
    void refresh();
  }

  async function scan() {
    if (!selectedId) {
      setMessage("Sélectionnez un bon.");
      return;
    }
    const tagCodes = tags
      .split(/[\s,;]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tagCodes.length === 0) return;
    const payload = handheldDeviceId
      ? { tagCodes, documentId: selectedId, handheldId: handheldDeviceId }
      : { tagCodes, source: "HANDHELD" };
    const scanUrl = handheldDeviceId
      ? "/api/handheld/scan"
      : `/api/stock-documents/${selectedId}/scan`;
    if (!online) {
      await enqueueOfflineAction({ type: "scan", documentId: selectedId, payload });
      setMessage("Scan en file d'attente (hors ligne)");
      setQueueLen((await getOfflineQueue()).length);
      setTags("");
      return;
    }
    const res = await apiFetch(scanUrl, { method: "POST", body: JSON.stringify(payload) });
    setMessage(res.ok ? "Scan enregistré" : "Échec scan");
    if (res.ok) {
      setTags("");
      void refresh();
    }
  }

  async function sign() {
    if (!selectedId) return;
    if (!online) {
      await enqueueOfflineAction({ type: "sign", documentId: selectedId, payload: {} });
      setMessage("Signature en file d'attente");
      setQueueLen((await getOfflineQueue()).length);
      return;
    }
    const res = await apiFetch(`/api/stock-documents/${selectedId}/sign`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    setMessage(data.message ?? (res.ok ? "Bon signé" : "Échec signature"));
    void refresh();
  }

  async function portiqueScan() {
    const tagCodes = tags
      .split(/[\s,;]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tagCodes.length === 0) return;
    const payload = { tagCodes, portalId: portalId || undefined };
    if (!online) {
      await enqueueOfflineAction({ type: "portique", payload });
      setMessage("Portique — file hors ligne");
      return;
    }
    const res = await apiFetch("/api/portique/scan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { message?: string; allowed?: boolean };
    setMessage(
      data.message ?? (data.allowed === false ? "Écart portique — sortie bloquée" : "Passage portique OK"),
    );
    void refresh();
  }

  async function submitIncident() {
    if (incidentDesc.trim().length < 5) {
      setMessage("Décrivez l'incident (5 caractères min.).");
      return;
    }
    if (!online) {
      setMessage("Signalement incident nécessite une connexion.");
      return;
    }
    const res = await apiFetch("/api/terrain/incidents", {
      method: "POST",
      body: JSON.stringify({
        incidentType,
        description: incidentDesc.trim(),
        eventId: incidentEventId || undefined,
        tagCode: incidentTag.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.ok) {
      setIncidentDesc("");
      setIncidentTag("");
      setMessage("Incident transmis — responsables notifiés.");
    } else {
      setMessage(data.message ?? "Échec envoi");
    }
  }

  const msgTone = message ? messageTone(message) : "info";

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Exécution RFID</Text>
      <Text style={styles.title}>Centre de contrôle</Text>

      <View style={styles.pills}>
        <View style={[styles.pill, online ? styles.pillOk : styles.pillWarn]}>
          <View style={styles.pillDot} />
          <Ionicons name={online ? "wifi-outline" : "cloud-offline-outline"} size={14} color={online ? colors.ok : colors.warn} />
          <Text style={[styles.pillText, online ? styles.pillTextOk : styles.pillTextWarn]}>
            {online ? "En ligne" : "Hors ligne"}
          </Text>
        </View>
        {queueLen > 0 ? (
          <View style={[styles.pill, styles.pillInfo]}>
            <Text style={styles.pillTextInfo}>{queueLen} en attente</Text>
          </View>
        ) : null}
        {documents.length > 0 ? (
          <View style={[styles.pill, styles.pillInfo]}>
            <Text style={styles.pillTextInfo}>
              {documents.length} bon{documents.length > 1 ? "s" : ""}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {TABS.map(({ id, label, icon }) => (
          <Pressable
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => {
              setTab(id);
              setMessage("");
            }}
          >
            <Ionicons name={icon} size={14} color={tab === id ? colors.gold2 : colors.text3} />
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {message ? (
        <View
          style={[
            styles.msg,
            msgTone === "err" && styles.msgErr,
            msgTone === "ok" && styles.msgOk,
          ]}
        >
          <Ionicons
            name={
              msgTone === "err"
                ? "alert-circle-outline"
                : msgTone === "ok"
                  ? "checkmark-circle-outline"
                  : "information-circle-outline"
            }
            size={18}
            color={msgTone === "err" ? colors.danger : msgTone === "ok" ? colors.ok : colors.info}
          />
          <Text style={styles.msgText}>{message}</Text>
        </View>
      ) : null}

      {tab === "bon" ? (
        <ScrollView style={styles.panel} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <Text style={styles.bonHint}>
            Bon de sortie chantier (BS-EVT) à partir des tags RFID — disponible hors ligne, synchronisé à la
            reconnexion.
          </Text>
          <PickerField
            label="Commande / chantier"
            value={createEventId}
            options={[
              { value: "", label: "— Choisir —" },
              ...eventOptions.map((e) => ({ value: e.id, label: e.name })),
            ]}
            onChange={setCreateEventId}
          />
          <Text style={styles.label}>Tags du bon</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={createTags}
            onChangeText={setCreateTags}
            placeholder="TAG-… (un par ligne)"
            placeholderTextColor={colors.text3}
          />
          <Pressable style={styles.btnPrimary} onPress={() => void createBon()}>
            <Ionicons name="document-text-outline" size={20} color={colors.navy} />
            <Text style={styles.btnPrimaryText}>Créer le bon BS-EVT</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {tab === "scan" ? (
        <ScrollView style={styles.panel} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <PickerField
            label="Bon actif"
            value={selectedId}
            options={[
              { value: "", label: "— Choisir un bon —" },
              ...documents.map((d) => ({
                value: d.id,
                label: `${d.documentNumber}${(d as CachedDocument).offline ? " · hors ligne" : ""} · ${DOC_KIND_LABELS[d.kind] ?? d.kind}`,
              })),
            ]}
            onChange={setSelectedId}
          />
          <PickerField
            label="Portique"
            value={portalId}
            options={[
              { value: "", label: "— Passage fixe —" },
              ...portals.map((p) => ({ value: p.id, label: p.label })),
            ]}
            onChange={setPortalId}
          />
          <PickerField
            label="Douchette"
            value={handheldDeviceId}
            options={[
              { value: "", label: "— Lecteur portable —" },
              ...handhelds.map((h) => ({ value: h.id, label: h.label })),
            ]}
            onChange={setHandheldDeviceId}
          />
          <Text style={styles.label}>Tags RFID</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={tags}
            onChangeText={setTags}
            placeholder="TAG-MOB-0001, un tag par ligne"
            placeholderTextColor={colors.text3}
          />
          <View style={styles.actions}>
            <ActionBtn icon="scan-outline" label="Douchette" primary onPress={() => void scan()} />
            <ActionBtn icon="radio-outline" label="Portique" onPress={() => void portiqueScan()} />
            <ActionBtn icon="create-outline" label="Signer" onPress={() => void sign()} />
            <ActionBtn icon="refresh-outline" label="Actualiser" ghost onPress={() => void refresh()} />
          </View>
        </ScrollView>
      ) : null}

      {tab === "assignments" ? (
        <ScrollView style={styles.panel} nestedScrollEnabled>
          {assignments.length === 0 && leaderEvents.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={32} color={colors.gold} />
              <Text style={styles.emptyText}>Aucune mission affectée.</Text>
            </View>
          ) : null}
          {assignments.map((a) => (
            <View key={a.id} style={styles.mission}>
              <Text style={styles.missionTitle}>{a.event.name}</Text>
              <Text style={styles.missionMeta}>
                {a.event.clientName} · {a.event.location}
              </Text>
              <Text style={styles.missionDates}>
                {new Date(a.event.startsAt).toLocaleDateString("fr-FR")} →{" "}
                {new Date(a.event.endsAt).toLocaleDateString("fr-FR")}
              </Text>
              <Text style={styles.badge}>
                {ORDER_STATUS_LABELS[a.event.orderStatus as keyof typeof ORDER_STATUS_LABELS] ??
                  a.event.orderStatus}
                {a.isTeamLeader ? " · Chef d'équipe" : ""}
              </Text>
              <Pressable
                style={styles.missionBtn}
                onPress={() => {
                  setIncidentEventId(a.event.id);
                  setTab("incident");
                  setMessage("Complétez le signalement ci-dessous.");
                }}
              >
                <Text style={styles.missionBtnText}>Réception / incident</Text>
              </Pressable>
            </View>
          ))}
          {leaderEvents
            .filter((e) => !assignments.some((a) => a.event.id === e.id))
            .map((e) => (
              <View key={e.id} style={styles.mission}>
                <Text style={styles.missionTitle}>{e.name}</Text>
                <Text style={[styles.badge, { color: colors.warn }]}>Chef d&apos;équipe désigné</Text>
              </View>
            ))}
        </ScrollView>
      ) : null}

      {tab === "incident" ? (
        <ScrollView style={styles.panel} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <PickerField
            label="Type d'incident"
            value={incidentType}
            options={[
              { value: "DAMAGE", label: "Casse" },
              { value: "LOSS", label: "Perte" },
              { value: "OTHER", label: "Autre" },
            ]}
            onChange={(v) => setIncidentType(v as typeof incidentType)}
          />
          <PickerField
            label="Commande / chantier"
            value={incidentEventId}
            options={[
              { value: "", label: "— Optionnel —" },
              ...eventOptions.map((e) => ({ value: e.id, label: e.name })),
            ]}
            onChange={setIncidentEventId}
          />
          <Text style={styles.label}>Tag RFID</Text>
          <TextInput
            style={styles.input}
            value={incidentTag}
            onChangeText={setIncidentTag}
            placeholder="TAG-XXXX-YYYY"
            placeholderTextColor={colors.text3}
            autoCapitalize="characters"
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={incidentDesc}
            onChangeText={setIncidentDesc}
            placeholder="Décrivez l'incident…"
            placeholderTextColor={colors.text3}
          />
          <Pressable style={styles.btnPrimary} onPress={() => void submitIncident()}>
            <Ionicons name="warning-outline" size={20} color={colors.navy} />
            <Text style={styles.btnPrimaryText}>Transmettre aux responsables</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
  );
}

function PickerField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const selected = options.find((o) => o.value === value)?.label ?? options[0]?.label;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {options.map((o) => (
          <Pressable
            key={o.value || "__empty"}
            style={[styles.chip, value === o.value && styles.chipActive]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.chipText, value === o.value && styles.chipTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {options.length > 6 ? (
        <Text style={styles.chipHint}>Sélection : {selected}</Text>
      ) : null}
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  primary,
  ghost,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  ghost?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.actionBtn,
        primary && styles.actionBtnPrimary,
        ghost && styles.actionBtnGhost,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={primary ? colors.navy : ghost ? colors.text3 : colors.text2}
      />
      <Text
        style={[
          styles.actionBtnText,
          primary && styles.actionBtnTextPrimary,
          ghost && styles.actionBtnTextGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.gold,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.md,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillOk: { backgroundColor: colors.okBg, borderColor: colors.okBorder },
  pillWarn: { backgroundColor: colors.warnBg, borderColor: "rgba(240,180,41,0.35)" },
  pillInfo: { backgroundColor: colors.infoBg, borderColor: "rgba(96,165,250,0.35)" },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ok },
  pillText: { fontSize: 11, fontWeight: "600" },
  pillTextOk: { color: colors.ok },
  pillTextWarn: { color: colors.warn },
  pillTextInfo: { color: colors.info, fontSize: 11, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: "rgba(212,160,79,0.2)" },
  tabLabel: { fontSize: 11, fontWeight: "600", color: colors.text3 },
  tabLabelActive: { color: colors.gold2 },
  msg: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.35)",
    marginBottom: spacing.md,
  },
  msgErr: { backgroundColor: colors.dangerBg, borderColor: "rgba(248,113,113,0.35)" },
  msgOk: { backgroundColor: colors.okBg, borderColor: colors.okBorder },
  msgText: { flex: 1, fontSize: 13, color: colors.text2 },
  panel: { maxHeight: 520 },
  bonHint: { fontSize: 12, color: colors.text3, lineHeight: 18, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.text3,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.25)",
    minHeight: 52,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  chipScroll: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border2,
    marginRight: 8,
    maxWidth: 200,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: "rgba(212,160,79,0.15)" },
  chipText: { fontSize: 12, color: colors.text3 },
  chipTextActive: { color: colors.gold2, fontWeight: "600" },
  chipHint: { fontSize: 11, color: colors.text3, marginTop: 6 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: spacing.sm,
  },
  actionBtn: {
    width: "48%",
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnPrimary: { backgroundColor: colors.gold, borderColor: colors.gold, width: "48%" },
  actionBtnGhost: { width: "100%" },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: colors.text2 },
  actionBtnTextPrimary: { color: colors.navy },
  actionBtnTextGhost: { color: colors.text3 },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    marginTop: spacing.md,
  },
  btnPrimaryText: { color: colors.navy, fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyText: { color: colors.text3, fontSize: 14 },
  mission: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: spacing.sm,
    borderTopWidth: 3,
    borderTopColor: colors.gold,
  },
  missionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  missionMeta: { fontSize: 12, color: colors.text3, marginTop: 4 },
  missionDates: { fontSize: 12, color: colors.text2, marginTop: 8 },
  badge: { fontSize: 10, fontWeight: "700", color: colors.info, marginTop: 8, textTransform: "uppercase" },
  missionBtn: {
    marginTop: 12,
    backgroundColor: colors.gold,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: "center",
  },
  missionBtnText: { color: colors.navy, fontWeight: "700", fontSize: 13 },
});
