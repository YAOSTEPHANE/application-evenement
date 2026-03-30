"use client";

type ToastProps = {
  message: string;
  visible: boolean;
  type?: "ok" | "danger" | "default";
};

export function Toast({ message, visible, type = "default" }: ToastProps) {
  const toneClass =
    type === "ok" ? "toast-ok" : type === "danger" ? "toast-danger" : "toast-default";

  return (
    <div id="toast" className={`${visible ? "show" : ""} ${toneClass}`.trim()}>
      {message}
    </div>
  );
}

