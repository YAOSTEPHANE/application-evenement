"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NavIcon, type AppIconName } from "@/components/icons/AppIcon";
import { CDC_MODULE_NAV, type CdcModulePageId } from "@/lib/cdc-modules";

/** Pages hors menu modules (profil, pages legacy encore montées dans MainContent). */
export type LegacyPageId =
  | "catalogue"
  | "categories"
  | "entrepots"
  | "stock-localisation"
  | "evenements"
  | "mouvements"
  | "rapports"
  | "scan"
  | "utilisateurs"
  | "parametres";

export type PageId = CdcModulePageId | LegacyPageId | "profil";

type SidebarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  alertesCount?: number;
  userInitials?: string;
  userFullName?: string;
  userAvatarUrl?: string;
  userRoleLabel?: string;
};

type NavEntry = {
  page: PageId;
  icon: AppIconName;
  label: string;
  badgeId?: string;
  badgeDanger?: boolean;
};

const MODULE_NAV: NavEntry[] = CDC_MODULE_NAV.map((entry) => ({
  page: entry.page,
  icon: entry.icon,
  label: entry.label,
  badgeId: entry.badgeId,
  badgeDanger: entry.badgeDanger,
}));

const MOBILE_PRIMARY_PAGES: CdcModulePageId[] = [
  "dashboard",
  "commandes",
  "bons",
  "rfid",
  "alertes",
];

export function Sidebar({
  activePage,
  onNavigate,
  alertesCount = 0,
  userInitials = "AD",
  userFullName = "Aminata Diallo",
  userAvatarUrl = "",
  userRoleLabel = "Administratrice",
}: SidebarProps) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileMoreClosing, setMobileMoreClosing] = useState(false);
  const itemClass = (page: PageId) => `nav-item${activePage === page ? " active" : ""}`;
  const mobileItemClass = (page: PageId) => `mobile-nav-item${activePage === page ? " active" : ""}`;

  const mobileMorePages = useMemo(
    () => MODULE_NAV.filter((e) => !MOBILE_PRIMARY_PAGES.includes(e.page as CdcModulePageId)),
    [],
  );

  const isSecondaryActive = useMemo(
    () =>
      mobileMorePages.some((e) => e.page === activePage) ||
      activePage === "profil" ||
      activePage === "parametres",
    [activePage, mobileMorePages],
  );

  const closeMobileMore = useCallback(() => {
    if (!mobileMoreOpen || mobileMoreClosing) return;
    setMobileMoreClosing(true);
    window.setTimeout(() => {
      setMobileMoreOpen(false);
      setMobileMoreClosing(false);
    }, 180);
  }, [mobileMoreClosing, mobileMoreOpen]);

  const openMobileMore = useCallback(() => {
    setMobileMoreClosing(false);
    setMobileMoreOpen(true);
  }, []);

  const toggleMobileMore = useCallback(() => {
    if (mobileMoreOpen) {
      closeMobileMore();
      return;
    }
    openMobileMore();
  }, [closeMobileMore, mobileMoreOpen, openMobileMore]);

  const goTo = useCallback(
    (page: PageId) => {
      onNavigate(page);
      setMobileMoreOpen(false);
      setMobileMoreClosing(false);
    },
    [onNavigate],
  );

  useEffect(() => {
    if (!mobileMoreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMore();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileMore, mobileMoreOpen]);

  const badgeCount = (id?: string) => {
    if (id === "nb-alertes") return alertesCount;
    return 0;
  };

  const renderNavGroup = (entries: NavEntry[]) =>
    entries.map((entry) => {
      const count = badgeCount(entry.badgeId);
      return (
        <div
          key={entry.page}
          className={itemClass(entry.page)}
          onClick={() => goTo(entry.page)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") goTo(entry.page);
          }}
        >
          <NavIcon name={entry.icon} />
          <span className="nav-label">{entry.label}</span>
          {entry.badgeId && count > 0 ? (
            <span className={`nav-badge${entry.badgeDanger ? " danger" : ""}`} id={entry.badgeId}>
              {count}
            </span>
          ) : null}
        </div>
      );
    });

  return (
    <aside id="sidebar">
      <div className="sidebar-desktop-content">
        <div className="nav-section nav-section-cdc">
          <span className="nav-section-dot" aria-hidden />
          EVENT · RFID
        </div>
        {renderNavGroup(MODULE_NAV)}

        <div
          className={itemClass("parametres")}
          onClick={() => goTo("parametres")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") goTo("parametres");
          }}
        >
          <NavIcon name="settings" />
          <span className="nav-label">Paramètres</span>
        </div>

        <Link
          href="/deconnexion"
          className="nav-item nav-item-logout"
          prefetch={false}
          onClick={() => {
            setMobileMoreOpen(false);
            setMobileMoreClosing(false);
          }}
        >
          <NavIcon name="logout" />
          <span className="nav-label">Déconnexion</span>
        </Link>

        <div className="sidebar-foot">
          <div className="foot-user" onClick={() => goTo("profil")} role="button" tabIndex={0}>
            <div className="foot-av" id="sideUserAv" aria-hidden="true">
              {userAvatarUrl ? (
                <Image
                  src={userAvatarUrl}
                  alt={userFullName}
                  fill
                  className="avatar-image"
                  sizes="36px"
                />
              ) : (
                userInitials
              )}
            </div>
            <div>
              <div className="foot-name" id="sideUserName">
                {userFullName}
              </div>
              <div className="foot-role" id="sideUserRole">
                {userRoleLabel}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-nav">
        {MODULE_NAV.filter((e) => MOBILE_PRIMARY_PAGES.includes(e.page as CdcModulePageId)).map(
          (entry) => (
            <button
              key={entry.page}
              type="button"
              className={mobileItemClass(entry.page)}
              onClick={() => goTo(entry.page)}
            >
              <NavIcon name={entry.icon} />
              <span>{entry.label}</span>
            </button>
          ),
        )}
        <button
          type="button"
          className={`mobile-nav-item${mobileMoreOpen || isSecondaryActive ? " active" : ""}`}
          onClick={toggleMobileMore}
          aria-expanded={mobileMoreOpen}
        >
          <span className="nav-icon-wrap nav-icon-wrap--more">
            <span className="nav-more-dots">⋯</span>
          </span>
          <span>Plus</span>
        </button>
      </div>

      {mobileMoreOpen || mobileMoreClosing ? (
        <>
          <button
            type="button"
            className={`mobile-more-overlay${mobileMoreClosing ? " is-closing" : ""}`}
            aria-label="Fermer le menu"
            onClick={closeMobileMore}
          />
          <div className={`mobile-more-panel${mobileMoreClosing ? " is-closing" : ""}`}>
            {mobileMorePages.map((entry) => (
              <button
                key={entry.page}
                type="button"
                className={mobileItemClass(entry.page)}
                onClick={() => goTo(entry.page)}
              >
                <NavIcon name={entry.icon} />
                <span>{entry.label}</span>
              </button>
            ))}
            <button type="button" className={mobileItemClass("profil")} onClick={() => goTo("profil")}>
              <NavIcon name="profile" />
              <span>Mon profil</span>
            </button>
            <button type="button" className={mobileItemClass("parametres")} onClick={() => goTo("parametres")}>
              <NavIcon name="settings" />
              <span>Paramètres</span>
            </button>
            <Link href="/deconnexion" className="mobile-nav-item" prefetch={false} onClick={closeMobileMore}>
              <NavIcon name="logout" />
              <span>Déconnexion</span>
            </Link>
          </div>
        </>
      ) : null}
    </aside>
  );
}
