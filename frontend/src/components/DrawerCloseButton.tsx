import { AppIcon } from "@/components/icons/AppIcon";

type DrawerCloseButtonProps = {
  onClick: () => void;
  className?: string;
  label?: string;
};

/** Fermeture des panneaux latéraux (drawers), aligné sur les modales. */
export function DrawerCloseButton({
  onClick,
  className = "drawer-close",
  label = "Fermer le panneau",
}: DrawerCloseButtonProps) {
  return (
    <button type="button" className={className} onClick={onClick} aria-label={label}>
      <AppIcon name="close" size={18} />
    </button>
  );
}
