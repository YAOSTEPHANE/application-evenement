"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { AppIcon, type AppIconName } from "@/components/icons/AppIcon";
import { ModalRoot } from "@/components/ModalRoot";

/* ── Grille & sections ───────────────────────────────────────────── */

type FormGridProps = {
  children: ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
};

export function FormGrid({ children, cols = 2, className = "" }: FormGridProps) {
  const colClass = cols === 1 ? "form-grid--1" : cols === 3 ? "form-grid--3" : "";
  return <div className={`form-grid form-premium ${colClass} ${className}`.trim()}>{children}</div>;
}

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({ title, description, children, className = "" }: FormSectionProps) {
  return (
    <section className={`form-section ${className}`.trim()}>
      <div className="form-section-hd">
        <h3 className="form-section-title">{title}</h3>
        {description ? <p className="form-section-desc">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/* ── Champ ───────────────────────────────────────────────────────── */

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  span?: "full" | "half";
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  span = "half",
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`fg ${span === "full" ? "full" : ""} ${error ? "fg--error" : ""} ${className}`.trim()}>
      <label htmlFor={htmlFor} className="form-label">
        {label}
        {required ? <span className="form-required" aria-hidden> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="form-hint">{hint}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}

type FormCheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  hint?: string;
  disabled?: boolean;
};

export function FormCheckbox({ label, checked, onChange, id, hint, disabled }: FormCheckboxProps) {
  const fieldId = id ?? `chk-${label.slice(0, 12).replace(/\s/g, "-")}`;
  return (
    <div className="fg full">
      <label className="form-check" htmlFor={fieldId}>
        <input
          type="checkbox"
          id={fieldId}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="form-check-box" aria-hidden />
        <span className="form-check-label">{label}</span>
      </label>
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

/* ── Contrôles ───────────────────────────────────────────────────── */

export function FormInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`fi ${className}`.trim()} {...props} />;
}

export function FormSelect({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={`fs ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function FormTextarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ft ${className}`.trim()} {...props} />;
}

/** Alias pour filtres / barres d’outils (même style que .fi). */
export function FormControl({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`form-input ${className}`.trim()} {...props} />;
}

/* ── Pied de formulaire ──────────────────────────────────────────── */

type FormActionsProps = {
  children: ReactNode;
  align?: "end" | "between";
  className?: string;
};

export function FormActions({ children, align = "end", className = "" }: FormActionsProps) {
  return (
    <div className={`modal-ft form-actions ${align === "between" ? "form-actions--between" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}

/* ── Modale formulaire ───────────────────────────────────────────── */

type ModalFormProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  icon?: AppIconName;
  titleId?: string;
  size?: "md" | "lg" | "xl";
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  id?: string;
};

export function ModalForm({
  isOpen,
  title,
  subtitle,
  icon = "documents",
  titleId,
  size = "md",
  onClose,
  footer,
  children,
  id,
}: ModalFormProps) {
  const sizeClass = size === "lg" ? " modal-lg" : size === "xl" ? " modal-xl" : "";
  return (
    <ModalRoot isOpen={isOpen} id={id}>
      <div
        className={`modal modal--form${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId ?? "modal-form-title"}
      >
        <header className="modal-hd modal-hd--premium">
          <div className="modal-hd-title">
            <span className="icon-badge icon-badge--sm modal-hd-icon" aria-hidden>
              <AppIcon name={icon} size={18} />
            </span>
            <div>
              <h2 id={titleId ?? "modal-form-title"}>{title}</h2>
              {subtitle ? <p className="modal-hd-sub">{subtitle}</p> : null}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            <AppIcon name="close" size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-ft form-actions">{footer}</div> : null}
      </div>
    </ModalRoot>
  );
}
