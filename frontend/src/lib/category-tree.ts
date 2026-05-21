import type { CategoryWithCount } from "@/lib/stock/api";

export type CategoryTreeNode = CategoryWithCount & {
  children: CategoryTreeNode[];
};

export function buildCategoryTree(rows: CategoryWithCount[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (row.parentId && nodes.has(row.parentId)) {
      nodes.get(row.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (list: CategoryTreeNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code, "fr"));
    for (const n of list) {
      sortNodes(n.children);
    }
  };
  sortNodes(roots);
  return roots;
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryWithCount[] {
  const out: CategoryWithCount[] = [];
  const walk = (list: CategoryTreeNode[]) => {
    for (const node of list) {
      const { children, ...row } = node;
      out.push(row);
      walk(children);
    }
  };
  walk(nodes);
  return out;
}

export const CATEGORY_LEVEL_LABELS = ["Racine", "Enfant", "Sous-enfant"] as const;

export function categoryLevelLabel(level: number): string {
  return CATEGORY_LEVEL_LABELS[level] ?? `Niveau ${level}`;
}

export function categoryPathLabel(
  rows: Array<{ id: string; name: string; parentId?: string | null }>,
  categoryId: string,
): string {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const parts: string[] = [];
  let current = byId.get(categoryId);
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(" › ");
}

/** Catégories feuilles (sans enfants) — assignables aux articles. */
export function leafCategories<T extends { id: string; parentId?: string | null; active?: boolean }>(
  rows: T[],
): T[] {
  const active = rows.filter((row) => row.active !== false);
  return active.filter((row) => !active.some((child) => child.parentId === row.id));
}
