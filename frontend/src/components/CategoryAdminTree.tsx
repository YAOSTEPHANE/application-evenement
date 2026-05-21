"use client";

import Image from "next/image";

import {
  buildCategoryTree,
  categoryLevelLabel,
  type CategoryTreeNode,
} from "@/lib/category-tree";
import type { CategoryParentPreset, CategoryWithCount } from "@/lib/stock/api";
import { fmtNum } from "@/lib/stock/helpers";

type CategoryAdminTreeProps = {
  rows: CategoryWithCount[];
  canManage: boolean;
  selectedId?: string | null;
  onSelect?: (row: CategoryWithCount) => void;
  onEdit: (row: CategoryWithCount) => void;
  onDelete: (row: CategoryWithCount) => void;
  onAddChild: (parent: CategoryParentPreset) => void;
  onToggleActive: (row: CategoryWithCount, active: boolean) => void;
};

function TreeRows({
  nodes,
  depth,
  canManage,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onToggleActive,
}: {
  nodes: CategoryTreeNode[];
  depth: number;
  canManage: boolean;
} & Omit<CategoryAdminTreeProps, "rows">) {
  return (
    <>
      {nodes.map((node) => (
        <CategoryRow
          key={node.id}
          node={node}
          depth={depth}
          canManage={canManage}
          selectedId={selectedId}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onToggleActive={onToggleActive}
        />
      ))}
    </>
  );
}

function CategoryRow({
  node,
  depth,
  canManage,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onToggleActive,
}: {
  node: CategoryTreeNode;
  depth: number;
  canManage: boolean;
} & Omit<CategoryAdminTreeProps, "rows">) {
  const canAddChild = node.level < 2;
  const deleteBlocked = node.itemCount > 0 || node.childrenCount > 0;
  const isSelected = selectedId === node.id;

  return (
    <>
      <tr
        className={[node.active ? "" : "cat-row-inactive", isSelected ? "categ-row--active" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={onSelect ? () => onSelect(node) : undefined}
        style={onSelect ? { cursor: "pointer" } : undefined}
      >
        <td>
          <div className="cat-tree-cell" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
            {depth > 0 ? <span className="cat-tree-branch" aria-hidden /> : null}
            <div className="cat-tree-main">
              {node.photoUrl ? (
                <Image
                  src={node.photoUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="cat-tree-photo"
                  unoptimized
                />
              ) : (
                <span className="cat-tree-icon">{node.icon || "▤"}</span>
              )}
              <div>
                <strong>{node.name}</strong>
                <div className="fs11 fc-3">{categoryLevelLabel(node.level)}</div>
              </div>
            </div>
          </div>
        </td>
        <td>
          <span className="ref-code">{node.code}</span>
        </td>
        <td className="fs12 fc-3 mono">{node.slug}</td>
        <td>{fmtNum(node.itemCount)}</td>
        <td>{fmtNum(node.childrenCount)}</td>
        <td>
          <span className={`badge ${node.active ? "badge-ok" : "badge-gray"}`}>
            {node.active ? "Actif" : "Inactif"}
          </span>
        </td>
        <td>
          {canManage ? (
            <div className="row-actions">
              {canAddChild ? (
                <>
                  <button
                    className="btn btn-outline btn-xs"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild({
                        id: node.id,
                        name: node.name,
                        code: node.code,
                        level: node.level,
                      });
                    }}
                  >
                    + Sous-cat.
                  </button>{" "}
                </>
              ) : null}
              <button
                className="btn btn-outline btn-xs"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleActive(node, !node.active);
                }}
              >
                {node.active ? "Désactiver" : "Activer"}
              </button>{" "}
              <button
                className="btn btn-outline btn-xs"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(node);
                }}
              >
                Modifier
              </button>{" "}
              <button
                className="btn btn-danger btn-xs"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node);
                }}
                disabled={deleteBlocked}
                title={
                  deleteBlocked
                    ? "Retirez les articles et sous-catégories avant suppression"
                    : undefined
                }
              >
                Suppr.
              </button>
            </div>
          ) : (
            <span className="fs12 fc-3">—</span>
          )}
        </td>
      </tr>
      {node.children.length > 0 ? (
        <TreeRows
          nodes={node.children}
          depth={depth + 1}
          canManage={canManage}
          selectedId={selectedId}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onToggleActive={onToggleActive}
        />
      ) : null}
    </>
  );
}

export function CategoryAdminTree({
  rows,
  canManage,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onToggleActive,
}: CategoryAdminTreeProps) {
  const tree = buildCategoryTree(rows);

  return (
    <div className="tbl-wrap categ-tree-wrap">
      <table className="tbl cat-tree-table data-table">
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Code</th>
            <th>Slug</th>
            <th>Articles</th>
            <th>Enfants</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <TreeRows
            nodes={tree}
            depth={0}
            canManage={canManage}
            selectedId={selectedId}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onToggleActive={onToggleActive}
          />
        </tbody>
      </table>
    </div>
  );
}
