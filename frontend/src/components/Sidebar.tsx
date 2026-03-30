"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

export type PageId =
  | "dashboard"
  | "catalogue"
  | "evenements"
  | "mouvements"
  | "rapports"
  | "alertes"
  | "scan"
  | "utilisateurs"
  | "profil";

type SidebarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  catalogueCount?: number;
  evenementsCount?: number;
  alertesCount?: number;
  userInitials?: string;
  userFullName?: string;
  userAvatarUrl?: string;
  userRoleLabel?: string;
};

export function Sidebar({
  activePage,
  onNavigate,
  catalogueCount = 0,
  evenementsCount = 0,
  alertesCount = 0,
  userInitials = "AD",
  userFullName = "Aminata Diallo",
  userAvatarUrl = "",
  userRoleLabel = "Administratrice",
}: SidebarProps) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileMoreClosing, setMobileMoreClosing] = useState(false);
  const itemClass = (page: PageId) =>
    `nav-item${activePage === page ? " active" : ""}`;
  const mobileItemClass = (page: PageId) =>
    `mobile-nav-item${activePage === page ? " active" : ""}`;

  const isSecondaryActive = useMemo(
    () =>
      activePage === "mouvements" ||
      activePage === "rapports" ||
      activePage === "utilisateurs" ||
      activePage === "profil",
    [activePage],
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

  return (
    <aside id="sidebar">
      <div className="sidebar-desktop-content">
        <div className="nav-section">Principal</div>

        <div className={itemClass("dashboard")} onClick={() => goTo("dashboard")}>
          <span className="nav-icon" aria-hidden="true">
            ⊞
          </span>
          Tableau de bord
        </div>

        <div className={itemClass("catalogue")} onClick={() => goTo("catalogue")}>
          <span className="nav-icon" aria-hidden="true">
            ◉
          </span>
          Catalogue
          <span className="nav-badge" id="nb-catalogue">
            {catalogueCount}
          </span>
        </div>

        <div className={itemClass("evenements")} onClick={() => goTo("evenements")}>
          <span className="nav-icon" aria-hidden="true">
            ◈
          </span>
          Événements
          <span className="nav-badge" id="nb-evenements">
            {evenementsCount}
          </span>
        </div>

        <div className={itemClass("mouvements")} onClick={() => goTo("mouvements")}>
          <span className="nav-icon" aria-hidden="true">
            ⇄
          </span>
          Mouvements
        </div>

        <div className="nav-section">Analyse</div>

        <div className={itemClass("rapports")} onClick={() => goTo("rapports")}>
          <span className="nav-icon" aria-hidden="true">
            ▦
          </span>
          Rapports
        </div>

        <div className={itemClass("alertes")} onClick={() => goTo("alertes")}>
          <span className="nav-icon" aria-hidden="true">
            ◬
          </span>
          Alertes
          <span className="nav-badge danger" id="nb-alertes">
            {alertesCount}
          </span>
        </div>

        <div className="nav-section">Outils</div>

        <div className={itemClass("scan")} onClick={() => goTo("scan")}>
          <span className="nav-icon" aria-hidden="true">
            ⊙
          </span>
          Scan / Sortie rapide
        </div>

        <div className={itemClass("utilisateurs")} onClick={() => goTo("utilisateurs")}>
          <span className="nav-icon" aria-hidden="true">
            ◎
          </span>
          Utilisateurs
        </div>

        <div className={itemClass("profil")} onClick={() => goTo("profil")}>
          <span className="nav-icon" aria-hidden="true">
            ☺
          </span>
          Mon profil
        </div>

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
        <button type="button" className={mobileItemClass("dashboard")} onClick={() => goTo("dashboard")}>
          <span className="nav-icon" aria-hidden="true">⊞</span>
          <span>Accueil</span>
        </button>
        <button type="button" className={mobileItemClass("catalogue")} onClick={() => goTo("catalogue")}>
          <span className="nav-icon" aria-hidden="true">◉</span>
          <span>Stock</span>
        </button>
        <button type="button" className={mobileItemClass("evenements")} onClick={() => goTo("evenements")}>
          <span className="nav-icon" aria-hidden="true">◈</span>
          <span>Events</span>
        </button>
        <button type="button" className={mobileItemClass("alertes")} onClick={() => goTo("alertes")}>
          <span className="nav-icon" aria-hidden="true">◬</span>
          <span>Alertes</span>
        </button>
        <button type="button" className={`mobile-nav-item${mobileItemClass("scan").includes("active") ? " active" : ""}`} onClick={() => goTo("scan")}>
          <span className="nav-icon" aria-hidden="true">⊙</span>
          <span>Scan</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item${mobileMoreOpen || isSecondaryActive ? " active" : ""}`}
          onClick={toggleMobileMore}
          aria-expanded={mobileMoreOpen}
        >
          <span className="nav-icon" aria-hidden="true">⋯</span>
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
            <button type="button" className={mobileItemClass("mouvements")} onClick={() => goTo("mouvements")}>
              <span className="nav-icon" aria-hidden="true">⇄</span>
              <span>Mouvements</span>
            </button>
            <button type="button" className={mobileItemClass("rapports")} onClick={() => goTo("rapports")}>
              <span className="nav-icon" aria-hidden="true">▦</span>
              <span>Rapports</span>
            </button>
            <button type="button" className={mobileItemClass("utilisateurs")} onClick={() => goTo("utilisateurs")}>
              <span className="nav-icon" aria-hidden="true">◎</span>
              <span>Utilisateurs</span>
            </button>
            <button type="button" className={mobileItemClass("profil")} onClick={() => goTo("profil")}>
              <span className="nav-icon" aria-hidden="true">☺</span>
              <span>Mon profil</span>
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}

