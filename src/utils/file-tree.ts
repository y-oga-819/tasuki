import type { FileDiff } from "../types";

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
  fileDiff?: FileDiff;
}

/** Collapse single-child directories (e.g., src/components → src/components) */
export function collapseNode(node: FileTreeNode): FileTreeNode {
  if (
    node.isDir &&
    node.children.length === 1 &&
    node.children[0].isDir
  ) {
    const child = node.children[0];
    return collapseNode({
      ...child,
      name: `${node.name}/${child.name}`,
      path: child.path,
    });
  }
  return {
    ...node,
    children: node.children.map(collapseNode),
  };
}

/** Sort: directories first, then alphabetically */
export function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((n) => ({ ...n, children: sortTreeNodes(n.children) }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Build a tree from flat file paths, collapsing single-child directories */
export function buildFileTree(files: FileDiff[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    isDir: true,
    children: [],
  };

  for (const fd of files) {
    const parts = fd.file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          name: part,
          path: fd.file.path,
          isDir: false,
          children: [],
          fileDiff: fd,
        });
      } else {
        let dirNode = current.children.find(
          (c) => c.isDir && c.name === part,
        );
        if (!dirNode) {
          dirNode = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.children.push(dirNode);
        }
        current = dirNode;
      }
    }
  }

  return sortTreeNodes(root.children.map(collapseNode));
}

/** Build a tree from plain path strings (no FileDiff) */
export function buildPathTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode = {
    name: "",
    path: "",
    isDir: true,
    children: [],
  };

  for (const p of paths) {
    const parts = p.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current.children.push({
          name: part,
          path: p,
          isDir: false,
          children: [],
        });
      } else {
        let dirNode = current.children.find(
          (c) => c.isDir && c.name === part,
        );
        if (!dirNode) {
          dirNode = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.children.push(dirNode);
        }
        current = dirNode;
      }
    }
  }

  return sortTreeNodes(root.children.map(collapseNode));
}

/** Flattened node for virtualized rendering */
export interface FlatNode {
  node: FileTreeNode;
  depth: number;
}

/** Flatten a tree into a linear array, skipping children of collapsed dirs */
export function flattenTree(
  nodes: FileTreeNode[],
  collapsedDirs: Set<string>,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.isDir && !collapsedDirs.has(node.path)) {
      result.push(...flattenTree(node.children, collapsedDirs, depth + 1));
    }
  }
  return result;
}
