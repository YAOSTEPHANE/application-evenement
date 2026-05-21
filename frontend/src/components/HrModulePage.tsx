"use client";

import { Role, StaffCategory, StaffSpecialty, VehicleStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  FormActions,
  FormCheckbox,
  FormField,
  FormGrid,
  FormInput,
  FormSelect,
  ModalForm,
} from "@/components/forms/FormPrimitives";
import { HrPersonnelCategoriesGuide } from "@/components/HrPersonnelCategoriesGuide";
import { ModuleGuideCollapse } from "@/components/ModuleGuideCollapse";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  ROLE_LABELS,
  STAFF_CATEGORY_LABELS,
  STAFF_SPECIALTY_LABELS,
  VEHICLE_STATUS_LABELS,
} from "@/lib/cdc-labels";
import {
  canBeDesignatedTeamLeader,
  categoryAllowsSpecialties,
  defaultAppRoleForStaffCategory,
  STAFF_MEMBER_APP_ROLES,
  STAFF_PROFILE_CATEGORIES,
} from "@/lib/cdc-hr-personnel";
import type { HrStats } from "@/lib/hr-db";
import { clientFetch, fetchAuthMe } from "@/lib/stock/api";

type TabId = "personnel" | "flotte" | "affectations" | "journaliers";
type StaffModalMode = "new" | "link";

type StaffRow = {
  id: string;
  category: StaffCategory;
  specialties: StaffSpecialty[];
  unavailable: boolean;
  unavailableUntil: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    active: boolean;
    vehicleAsDriver?: { id: string; label: string; plateNumber: string } | null;
  };
};

type VehicleRow = {
  id: string;
  label: string;
  plateNumber: string;
  capacityNotes: string | null;
  status: VehicleStatus;
  active: boolean;
  driver?: { id: string; fullName: string } | null;
};

type AssignmentRow = {
  id: string;
  isTeamLeader: boolean;
  assignedAt: string;
  user: { id: string; fullName: string; role: string };
  event: { id: string; name: string; startsAt: string; endsAt: string };
};

type DailyRow = {
  id: string;
  workDate: string;
  fullName: string;
  hoursWorked: number;
  dailyRate: number;
  accountCode: string | null;
  sentToPayroll: boolean;
  morningDeclaredAt: string | null;
  event?: { id: string; name: string } | null;
};

type UserOption = { id: string; fullName: string; email: string };

type HrModulePageProps = {
  events: Array<{ id: string; label: string }>;
};

const STAFF_CATEGORIES = STAFF_PROFILE_CATEGORIES;
const STAFF_SPECIALTIES = Object.keys(STAFF_SPECIALTY_LABELS) as StaffSpecialty[];
const VEHICLE_STATUSES = Object.keys(VEHICLE_STATUS_LABELS) as VehicleStatus[];

function vehicleStatusClass(status: VehicleStatus): string {
  if (status === VehicleStatus.AVAILABLE) return "hr-veh--ok";
  if (status === VehicleStatus.IN_USE) return "hr-veh--busy";
  return "hr-veh--maint";
}

export function HrModulePage({ events }: HrModulePageProps) {
  const [tab, setTab] = useState<TabId>("personnel");
  const [stats, setStats] = useState<HrStats | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [dailyWorkers, setDailyWorkers] = useState<DailyRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEventId, setFilterEventId] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [modalStaff, setModalStaff] = useState(false);
  const [staffModalMode, setStaffModalMode] = useState<StaffModalMode>("new");
  const [modalVehicle, setModalVehicle] = useState(false);
  const [modalAssign, setModalAssign] = useState(false);
  const [modalDaily, setModalDaily] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [staffUserId, setStaffUserId] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffFullName, setStaffFullName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffAppRole, setStaffAppRole] = useState<Role>(Role.TECHNICIAN);
  const [staffCategory, setStaffCategory] = useState<StaffCategory>(StaffCategory.RIGGER_CONFIRMED);
  const [staffSpecs, setStaffSpecs] = useState<StaffSpecialty[]>([]);
  const [staffVehicleId, setStaffVehicleId] = useState("");
  const [staffUnavailable, setStaffUnavailable] = useState(false);

  const [vehLabel, setVehLabel] = useState("");
  const [vehPlate, setVehPlate] = useState("");
  const [vehNotes, setVehNotes] = useState("");
  const [vehStatus, setVehStatus] = useState<VehicleStatus>(VehicleStatus.AVAILABLE);

  const [assignEventId, setAssignEventId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignLeader, setAssignLeader] = useState(false);

  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyName, setDailyName] = useState("");
  const [dailyEventId, setDailyEventId] = useState("");
  const [dailyHours, setDailyHours] = useState("8");
  const [dailyRate, setDailyRate] = useState("");
  const [dailyMorning, setDailyMorning] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterEventId ? `?eventId=${filterEventId}` : "";
      const [statsRes, staffRes, vehRes, assignRes, dailyRes, usersRes, me] = await Promise.all([
        clientFetch("/api/cdc/hr/stats"),
        clientFetch("/api/hr/staff"),
        clientFetch("/api/hr/vehicles"),
        clientFetch(`/api/hr/assignments${q}`),
        clientFetch("/api/hr/daily-workers"),
        clientFetch("/api/users"),
        fetchAuthMe(),
      ]);
      if (statsRes.ok) setStats((await statsRes.json()) as HrStats);
      if (staffRes.ok) setStaff((await staffRes.json()) as StaffRow[]);
      if (vehRes.ok) setVehicles((await vehRes.json()) as VehicleRow[]);
      if (assignRes.ok) setAssignments((await assignRes.json()) as AssignmentRow[]);
      if (dailyRes.ok) setDailyWorkers((await dailyRes.json()) as DailyRow[]);
      if (usersRes.ok) {
        const raw = (await usersRes.json()) as Array<{ id: string; fullName: string; email: string }>;
        setUsers(raw.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })));
      }
      setIsAdmin(me?.role === Role.ADMIN);
    } finally {
      setLoading(false);
    }
  }, [filterEventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffWithoutProfile = useMemo(() => {
    const linked = new Set(staff.map((s) => s.user.id));
    return users.filter((u) => !linked.has(u.id));
  }, [staff, users]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.user.fullName.toLowerCase().includes(q) ||
        STAFF_CATEGORY_LABELS[s.category].toLowerCase().includes(q),
    );
  }, [staff, search]);

  const staffByCategory = useMemo(() => {
    const map = new Map<StaffCategory, StaffRow[]>();
    for (const cat of STAFF_CATEGORIES) {
      map.set(cat, []);
    }
    for (const s of filteredStaff) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return STAFF_CATEGORIES.map((cat) => ({
      category: cat,
      label: STAFF_CATEGORY_LABELS[cat],
      rows: map.get(cat) ?? [],
    })).filter((g) => g.rows.length > 0);
  }, [filteredStaff]);

  const teamLeaderEligible = useMemo(
    () => staff.filter((s) => canBeDesignatedTeamLeader(s.category)),
    [staff],
  );

  const assignLeaderHint = useMemo(() => {
    if (!assignLeader) return null;
    const selected = staff.find((s) => s.user.id === assignUserId);
    if (selected && !canBeDesignatedTeamLeader(selected.category)) {
      return "Seuls les monteurs seniors ou profils chef d'équipe peuvent être désignés.";
    }
    return "Un seul chef d'équipe par commande (remplace le précédent).";
  }, [assignLeader, assignUserId, staff]);

  const assignmentsByEvent = useMemo(() => {
    const map = new Map<string, { name: string; rows: AssignmentRow[] }>();
    for (const a of assignments) {
      const cur = map.get(a.event.id) ?? { name: a.event.name, rows: [] };
      cur.rows.push(a);
      map.set(a.event.id, cur);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "fr"));
  }, [assignments]);

  function staffCategoryPayload() {
    return {
      category: staffCategory,
      specialties: categoryAllowsSpecialties(staffCategory) ? staffSpecs : [],
      vehicleId: staffCategory === StaffCategory.DRIVER ? staffVehicleId || null : null,
      unavailable: staffUnavailable,
    };
  }

  async function saveStaff() {
    setFormError(null);
    if (staffModalMode === "link") {
      if (!staffUserId) {
        setFormError("Sélectionnez un utilisateur.");
        return;
      }
    } else {
      if (!staffFullName.trim() || !staffEmail.trim() || !staffUsername.trim()) {
        setFormError("Nom complet, identifiant et email sont requis.");
        return;
      }
      if (staffPassword.length < 8) {
        setFormError("Mot de passe : 8 caractères minimum.");
        return;
      }
    }
    if (staffCategory === StaffCategory.DRIVER && !staffVehicleId) {
      setFormError("Sélectionnez un véhicule pour le chauffeur.");
      return;
    }
    setSaving(true);
    try {
      const body =
        staffModalMode === "link"
          ? { userId: staffUserId, ...staffCategoryPayload() }
          : {
              username: staffUsername.trim(),
              fullName: staffFullName.trim(),
              email: staffEmail.trim(),
              password: staffPassword,
              role: staffAppRole,
              ...staffCategoryPayload(),
            };
      const res = await clientFetch("/api/hr/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setFormError(err.message ?? "Enregistrement impossible");
        return;
      }
      setModalStaff(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveVehicle() {
    setFormError(null);
    if (!vehLabel.trim() || !vehPlate.trim()) {
      setFormError("Libellé et immatriculation requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await clientFetch("/api/hr/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: vehLabel.trim(),
          plateNumber: vehPlate.trim(),
          capacityNotes: vehNotes.trim() || undefined,
          status: vehStatus,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setFormError(err.message ?? "Création impossible");
        return;
      }
      setModalVehicle(false);
      setVehLabel("");
      setVehPlate("");
      setVehNotes("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function patchVehicleStatus(id: string, status: VehicleStatus) {
    await clientFetch(`/api/hr/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  async function saveAssignment() {
    setFormError(null);
    if (!assignEventId || !assignUserId) {
      setFormError("Commande et collaborateur requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await clientFetch("/api/hr/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: assignEventId,
          userId: assignUserId,
          isTeamLeader: assignLeader,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setFormError(err.message ?? "Affectation impossible");
        return;
      }
      setModalAssign(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveDaily() {
    setFormError(null);
    if (!dailyName.trim()) {
      setFormError("Nom du journalier requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await clientFetch("/api/hr/daily-workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: dailyDate,
          fullName: dailyName.trim(),
          eventId: dailyEventId || undefined,
          hoursWorked: Number(dailyHours) || 8,
          dailyRate: dailyRate ? Number(dailyRate) : undefined,
          morningPresence: dailyMorning,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setFormError(err.message ?? "Enregistrement impossible");
        return;
      }
      setModalDaily(false);
      setDailyName("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function setStaffCategoryWithDefaults(cat: StaffCategory) {
    setStaffCategory(cat);
    if (!categoryAllowsSpecialties(cat)) setStaffSpecs([]);
    if (staffModalMode === "new") {
      setStaffAppRole(defaultAppRoleForStaffCategory(cat));
    }
  }

  function openStaffModal() {
    const preferLink = staffWithoutProfile.length > 0;
    setStaffModalMode(preferLink ? "link" : "new");
    setStaffUserId(staffWithoutProfile[0]?.id ?? "");
    setStaffUsername("");
    setStaffFullName("");
    setStaffEmail("");
    setStaffPassword("");
    setStaffCategory(StaffCategory.RIGGER_CONFIRMED);
    setStaffAppRole(Role.TECHNICIAN);
    setStaffSpecs([]);
    setStaffVehicleId(vehicles.find((v) => !v.driver)?.id ?? "");
    setStaffUnavailable(false);
    setFormError(null);
    setModalStaff(true);
  }

  function toggleSpec(spec: StaffSpecialty) {
    setStaffSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec],
    );
  }

  const occupancyStyle = stats
    ? ({ ["--hr-occ-pct" as string]: `${stats.staffOccupancyPct}%` } as CSSProperties)
    : undefined;

  return (
    <div className="hr-premium">
      <section className="hr-hero">
        <div className="hr-hero-grid">
          <div>
            <h1 className="hr-hero-title">Ressources humaines</h1>
          </div>
          <div className="hr-hero-actions">
            <button
              type="button"
              className="hr-hero-btn hr-hero-btn--ghost"
              disabled={loading}
              onClick={() => void load()}
            >
              <AppIcon name="sync" size={14} />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <ModuleGuideCollapse title="Catégories de personnel (référence)" className="hr-guide-block">
        <HrPersonnelCategoriesGuide />
      </ModuleGuideCollapse>

      <div className="hr-kpi-row">
        <div className="hr-kpi hr-kpi--accent">
          <div className="hr-kpi-ring" style={occupancyStyle} aria-hidden>
            <span className="hr-kpi-ring-val">{stats ? `${stats.staffOccupancyPct}%` : "—"}</span>
          </div>
          <div className="hr-kpi-lbl">Occupation effectifs</div>
          <div className="hr-kpi-sub">
            {stats ? `${stats.staffOccupied} / ${stats.staffTotal} affectés` : "—"}
          </div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">{stats?.teamLeadersTotal ?? "—"}</div>
          <div className="hr-kpi-lbl">Chefs d&apos;équipe</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">{stats?.vehiclesAvailable ?? "—"}</div>
          <div className="hr-kpi-lbl">Véhicules disponibles</div>
          <div className="hr-kpi-sub">{stats ? `${stats.vehiclesInUse} en mission` : ""}</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">{stats?.eventsWithCrew ?? "—"}</div>
          <div className="hr-kpi-lbl">Commandes avec équipe</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">{stats?.riggersTotal ?? "—"}</div>
          <div className="hr-kpi-lbl">Monteurs</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">
            {stats ? `${stats.driversWithVehicle}/${stats.driversTotal}` : "—"}
          </div>
          <div className="hr-kpi-lbl">Chauffeurs / véhicule</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">{stats?.dailyWorkersMonth ?? "—"}</div>
          <div className="hr-kpi-lbl">Journaliers (mois)</div>
        </div>
        <div className="hr-kpi">
          <div className="hr-kpi-val">{stats?.dailyDeclaredToday ?? "—"}</div>
          <div className="hr-kpi-lbl">Présents ce matin</div>
        </div>
        <div className={`hr-kpi${stats && stats.dailyPendingPayroll > 0 ? " hr-kpi--warn" : ""}`}>
          <div className="hr-kpi-val">{stats?.dailyPendingPayroll ?? "—"}</div>
          <div className="hr-kpi-lbl">À exporter paie</div>
        </div>
      </div>

      <div className="hr-tabs" role="tablist">
        {(
          [
            ["personnel", "team", "Personnel"],
            ["flotte", "terrain", "Parc camion"],
            ["affectations", "orders", "Affectations"],
            ["journaliers", "events", "Journaliers"],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id ? "true" : "false"}
            className={`hr-tab${tab === id ? " hr-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            <AppIcon name={icon} size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "personnel" ? (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <AppIcon name="search" size={16} />
            <input
              type="search"
              placeholder="Rechercher un nom ou une catégorie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isAdmin ? (
              <button type="button" className="btn btn-gold btn-sm btn-icon" onClick={openStaffModal}>
                <AppIcon name="plus" size={14} />
                Ajouter du personnel
              </button>
            ) : null}
          </div>
          {filteredStaff.length === 0 ? (
            <p className="hr-empty">
              {isAdmin
                ? "Aucun profil terrain. Créez un membre ou liez un compte existant."
                : "Aucun profil terrain enregistré."}
            </p>
          ) : (
            <div className="hr-staff-sections">
              {staffByCategory.map((group) => (
                <section key={group.category} className="hr-staff-section">
                  <h3 className="hr-staff-section-title">{group.label}</h3>
                  <div className="hr-staff-grid">
                    {group.rows.map((s) => (
                      <article
                        key={s.id}
                        className={`hr-staff-card${s.unavailable ? " hr-staff-card--off" : ""}`}
                      >
                        <div className="hr-staff-card-top">
                          <h4>{s.user.fullName}</h4>
                          {s.unavailable ? (
                            <span className="hr-badge hr-badge--warn">Indisponible</span>
                          ) : null}
                          {s.category === StaffCategory.TEAM_LEADER ||
                          s.category === StaffCategory.RIGGER_SENIOR ? (
                            <span className="hr-badge hr-badge--gold">Chef éligible</span>
                          ) : null}
                        </div>
                        {s.user.vehicleAsDriver ? (
                          <p className="hr-staff-vehicle fs12">
                            Véhicule : {s.user.vehicleAsDriver.label} ({s.user.vehicleAsDriver.plateNumber})
                          </p>
                        ) : null}
                        {s.specialties.length > 0 ? (
                          <div className="hr-pills">
                            {s.specialties.map((sp) => (
                              <span key={sp} className="hr-pill">
                                {STAFF_SPECIALTY_LABELS[sp]}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="hr-staff-email">{s.user.email}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "flotte" ? (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <span className="hr-toolbar-label">{vehicles.length} véhicule(s)</span>
            <button
              type="button"
              className="btn btn-gold btn-sm btn-icon"
              onClick={() => {
                setFormError(null);
                setModalVehicle(true);
              }}
            >
              <AppIcon name="plus" size={14} />
              Ajouter
            </button>
          </div>
          <div className="hr-veh-grid">
            {vehicles.length === 0 ? (
              <p className="hr-empty">Aucun véhicule enregistré.</p>
            ) : (
              vehicles.map((v) => (
                <article key={v.id} className={`hr-veh-card ${vehicleStatusClass(v.status)}`}>
                  <div className="hr-veh-card-top">
                    <h3>{v.label}</h3>
                    <span className="hr-veh-plate">{v.plateNumber}</span>
                  </div>
                  <p className="hr-veh-status">{VEHICLE_STATUS_LABELS[v.status]}</p>
                  {v.driver ? (
                    <p className="hr-veh-driver fs12">Chauffeur : {v.driver.fullName}</p>
                  ) : (
                    <p className="hr-veh-driver fs12 text-muted">Sans chauffeur rattaché</p>
                  )}
                  {v.capacityNotes ? <p className="hr-veh-notes">{v.capacityNotes}</p> : null}
                  <div className="hr-veh-actions">
                    {VEHICLE_STATUSES.filter((s) => s !== v.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => void patchVehicleStatus(v.id, s)}
                      >
                        {VEHICLE_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "affectations" ? (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <FormSelect
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              className="hr-filter-select"
            >
              <option value="">Toutes les commandes</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </FormSelect>
            <button
              type="button"
              className="btn btn-gold btn-sm btn-icon"
              onClick={() => {
                setAssignEventId(events[0]?.id ?? "");
                setAssignUserId(staff[0]?.user.id ?? "");
                setAssignLeader(false);
                setFormError(null);
                setModalAssign(true);
              }}
            >
              <AppIcon name="plus" size={14} />
              Affecter
            </button>
          </div>
          {assignmentsByEvent.length === 0 ? (
            <p className="hr-empty">Aucune affectation sur la période.</p>
          ) : (
            <div className="hr-assign-list">
              {assignmentsByEvent.map(([eventId, group]) => (
                <section key={eventId} className="hr-assign-block">
                  <h3>{group.name}</h3>
                  <ul>
                    {group.rows.map((a) => (
                      <li key={a.id}>
                        <span className="hr-assign-name">
                          {a.user.fullName}
                          {a.isTeamLeader ? (
                            <span className="hr-badge hr-badge--gold">Chef</span>
                          ) : null}
                        </span>
                        <span className="hr-assign-date">
                          {new Date(a.assignedAt).toLocaleDateString("fr-FR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "journaliers" ? (
        <div className="hr-panel">
          <div className="hr-toolbar">
            <a
              className="btn btn-sm btn-outline btn-icon"
              href="/api/hr/daily-workers/export?markSent=1"
              download
            >
              <AppIcon name="fileExport" size={14} />
              Export compta CSV
            </a>
            <button
              type="button"
              className="btn btn-gold btn-sm btn-icon"
              onClick={() => {
                setFormError(null);
                setModalDaily(true);
              }}
            >
              <AppIcon name="plus" size={14} />
              Saisir
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table hr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nom</th>
                  <th>Commande</th>
                  <th>Heures</th>
                  <th>Taux</th>
                  <th>Présence matin</th>
                  <th>Paie</th>
                </tr>
              </thead>
              <tbody>
                {dailyWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="hr-empty-cell">
                      Aucun journalier.
                    </td>
                  </tr>
                ) : (
                  dailyWorkers.map((w) => (
                    <tr key={w.id}>
                      <td>{new Date(w.workDate).toLocaleDateString("fr-FR")}</td>
                      <td>{w.fullName}</td>
                      <td>{w.event?.name ?? "—"}</td>
                      <td>{w.hoursWorked} h</td>
                      <td>{w.dailyRate > 0 ? `${w.dailyRate} €` : "—"}</td>
                      <td>
                        {w.morningDeclaredAt ? (
                          <span className="hr-badge hr-badge--ok">
                            {new Date(w.morningDeclaredAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : (
                          <span className="hr-badge hr-badge--warn">Non déclaré</span>
                        )}
                      </td>
                      <td>
                        {w.sentToPayroll ? (
                          <span className="hr-badge hr-badge--ok">Exporté</span>
                        ) : (
                          <span className="hr-badge hr-badge--warn">En attente</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <ModalForm
        isOpen={modalStaff}
        title="Ajouter du personnel"
        subtitle={
          staffModalMode === "new"
            ? "Créer le compte et le profil terrain"
            : "Lier un compte existant à une catégorie d'effectif"
        }
        icon="team"
        onClose={() => setModalStaff(false)}
        footer={
          <FormActions>
            <button type="button" className="btn btn-outline" onClick={() => setModalStaff(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-gold" disabled={saving} form="hr-staff-modal-form">
              {staffModalMode === "new" ? "Créer" : "Enregistrer"}
            </button>
          </FormActions>
        }
      >
        <form
          id="hr-staff-modal-form"
          className="hr-staff-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveStaff();
          }}
        >
        <FormGrid>
          <div className="full hr-staff-mode-tabs">
            <button
              type="button"
              className={`hr-staff-mode-tab${staffModalMode === "new" ? " hr-staff-mode-tab--on" : ""}`}
              onClick={() => setStaffModalMode("new")}
            >
              Nouveau membre
            </button>
            <button
              type="button"
              className={`hr-staff-mode-tab${staffModalMode === "link" ? " hr-staff-mode-tab--on" : ""}`}
              onClick={() => setStaffModalMode("link")}
              disabled={staffWithoutProfile.length === 0}
              title={
                staffWithoutProfile.length === 0
                  ? "Aucun utilisateur sans profil terrain"
                  : undefined
              }
            >
              Compte existant
            </button>
          </div>
          {staffModalMode === "new" ? (
            <>
              <FormField label="Nom complet" required span="full">
                <FormInput
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </FormField>
              <FormField label="Identifiant" required>
                <FormInput
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  placeholder="prenom.nom"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Email" required>
                <FormInput
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="email@agence.ci"
                />
              </FormField>
              <FormField label="Mot de passe" required span="full">
                <FormInput
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  autoComplete="new-password"
                />
              </FormField>
              <FormField label="Profil applicatif" required span="full">
                <FormSelect
                  value={staffAppRole}
                  onChange={(e) => setStaffAppRole(e.target.value as Role)}
                >
                  {STAFF_MEMBER_APP_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </>
          ) : (
            <FormField label="Utilisateur" required span="full">
              <FormSelect value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}>
                <option value="">— Choisir —</option>
                {staffWithoutProfile.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </FormSelect>
            </FormField>
          )}
          <FormField label="Catégorie" required>
            <FormSelect
              value={staffCategory}
              onChange={(e) => setStaffCategoryWithDefaults(e.target.value as StaffCategory)}
            >
              {STAFF_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {STAFF_CATEGORY_LABELS[c]}
                </option>
              ))}
            </FormSelect>
          </FormField>
          {staffCategory === StaffCategory.DRIVER ? (
            <FormField label="Véhicule du parc" required span="full">
              <FormSelect
                value={staffVehicleId}
                onChange={(e) => setStaffVehicleId(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {vehicles
                  .filter((v) => !v.driver || v.driver.id === staffUserId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} ({v.plateNumber})
                    </option>
                  ))}
              </FormSelect>
            </FormField>
          ) : null}
          {categoryAllowsSpecialties(staffCategory) ? (
            <FormField label="Spécialités monteur" span="full">
              <div className="hr-spec-chips">
                {STAFF_SPECIALTIES.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`hr-spec-chip${staffSpecs.includes(sp) ? " hr-spec-chip--on" : ""}`}
                    onClick={() => toggleSpec(sp)}
                  >
                    {STAFF_SPECIALTY_LABELS[sp]}
                  </button>
                ))}
              </div>
            </FormField>
          ) : null}
          <FormCheckbox
            label="Marquer indisponible"
            checked={staffUnavailable}
            onChange={setStaffUnavailable}
          />
          {formError ? <p className="form-error full" role="alert">{formError}</p> : null}
        </FormGrid>
        </form>
      </ModalForm>

      <ModalForm
        isOpen={modalVehicle}
        title="Nouveau véhicule"
        icon="terrain"
        onClose={() => setModalVehicle(false)}
        footer={
          <FormActions>
            <button type="button" className="btn btn-outline" onClick={() => setModalVehicle(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void saveVehicle()}>
              Créer
            </button>
          </FormActions>
        }
      >
        <FormGrid>
          <FormField label="Libellé" required>
            <FormInput value={vehLabel} onChange={(e) => setVehLabel(e.target.value)} />
          </FormField>
          <FormField label="Immatriculation" required>
            <FormInput value={vehPlate} onChange={(e) => setVehPlate(e.target.value)} />
          </FormField>
          <FormField label="Statut">
            <FormSelect
              value={vehStatus}
              onChange={(e) => setVehStatus(e.target.value as VehicleStatus)}
            >
              {VEHICLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {VEHICLE_STATUS_LABELS[s]}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Capacité / notes" span="full">
            <FormInput value={vehNotes} onChange={(e) => setVehNotes(e.target.value)} />
          </FormField>
          {formError ? <p className="form-error full" role="alert">{formError}</p> : null}
        </FormGrid>
      </ModalForm>

      <ModalForm
        isOpen={modalAssign}
        title="Affectation projet"
        subtitle="Rattacher un collaborateur à une commande"
        icon="orders"
        onClose={() => setModalAssign(false)}
        footer={
          <FormActions>
            <button type="button" className="btn btn-outline" onClick={() => setModalAssign(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void saveAssignment()}>
              Affecter
            </button>
          </FormActions>
        }
      >
        <FormGrid>
          <FormField label="Commande" required span="full">
            <FormSelect value={assignEventId} onChange={(e) => setAssignEventId(e.target.value)}>
              <option value="">— Choisir —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Collaborateur" required span="full">
            <FormSelect value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
              <option value="">— Choisir —</option>
              {staff.map((s) => (
                <option key={s.user.id} value={s.user.id}>
                  {s.user.fullName} — {STAFF_CATEGORY_LABELS[s.category]}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormCheckbox
            label="Chef d'équipe sur cette commande (1 par projet)"
            checked={assignLeader}
            onChange={setAssignLeader}
          />
          {assignLeader ? (
            <p className="fs12 text-muted full">
              Éligibles :{" "}
              {teamLeaderEligible.map((s) => s.user.fullName).join(", ") || "aucun profil senior"}
            </p>
          ) : null}
          {assignLeaderHint ? (
            <p className={`form-hint full${assignLeaderHint.includes("Seuls") ? " form-error" : ""}`}>
              {assignLeaderHint}
            </p>
          ) : null}
          {formError ? <p className="form-error full" role="alert">{formError}</p> : null}
        </FormGrid>
      </ModalForm>

      <ModalForm
        isOpen={modalDaily}
        title="Journalier"
        subtitle="Présence quotidienne déclarée le matin"
        icon="events"
        onClose={() => setModalDaily(false)}
        footer={
          <FormActions>
            <button type="button" className="btn btn-outline" onClick={() => setModalDaily(false)}>
              Annuler
            </button>
            <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void saveDaily()}>
              Enregistrer
            </button>
          </FormActions>
        }
      >
        <FormGrid>
          <FormField label="Date" required>
            <FormInput type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
          </FormField>
          <FormField label="Nom" required>
            <FormInput value={dailyName} onChange={(e) => setDailyName(e.target.value)} />
          </FormField>
          <FormField label="Commande (optionnel)" span="full">
            <FormSelect value={dailyEventId} onChange={(e) => setDailyEventId(e.target.value)}>
              <option value="">— Aucune —</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Heures">
            <FormInput type="number" min={0.5} max={24} step={0.5} value={dailyHours} onChange={(e) => setDailyHours(e.target.value)} />
          </FormField>
          <FormField label="Taux journalier (€)">
            <FormInput type="number" min={0} value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
          </FormField>
          <FormCheckbox
            label="Présence déclarée ce matin"
            checked={dailyMorning}
            onChange={setDailyMorning}
          />
          {formError ? <p className="form-error full" role="alert">{formError}</p> : null}
        </FormGrid>
      </ModalForm>
    </div>
  );
}
