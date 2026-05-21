import { AppIcon, type AppIconName } from "@/components/icons/AppIcon";

type ModalHeaderProps = {
  icon: AppIconName;
  title: string;
  subtitle?: string;
  onClose: () => void;
  titleId?: string;
};

export function ModalHeader({ icon, title, subtitle, onClose, titleId }: ModalHeaderProps) {
  return (
    <header className="modal-hd modal-hd--premium">
      <div className="modal-hd-title">
        <span className="icon-badge icon-badge--sm" aria-hidden>
          <AppIcon name={icon} size={18} />
        </span>
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p className="modal-hd-sub">{subtitle}</p> : null}
        </div>
      </div>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
        <AppIcon name="close" size={16} />
      </button>
    </header>
  );
}
