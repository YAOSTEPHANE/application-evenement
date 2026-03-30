export function getInputValue(id: string) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value ?? "";
}

export function getSelectValue(id: string) {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  return el?.value ?? "";
}

