import { describe, it, expect } from "vitest";
import {
  buildFileTree,
  buildPathTree,
  flattenTree,
  collapseNode,
  sortTreeNodes,
  type FileTreeNode,
} from "../utils/file-tree";
import type { FileDiff } from "../types";

/* ── helpers ── */

/** Minimal FileDiff factory for testing */
function fd(path: string): FileDiff {
  return {
    file: {
      path,
      old_path: null,
      status: "modified",
      additions: 1,
      deletions: 0,
      is_binary: false,
      is_generated: false,
    },
    hunks: [],
    old_content: null,
    new_content: null,
  };
}

function leaf(name: string, path: string): FileTreeNode {
  return { name, path, isDir: false, children: [] };
}

function dir(
  name: string,
  path: string,
  children: FileTreeNode[],
): FileTreeNode {
  return { name, path, isDir: true, children };
}

/* ── collapseNode ── */

describe("collapseNode", () => {
  it("collapses single-child directory chain", () => {
    // src -> components -> Button.tsx
    const node = dir("src", "src", [
      dir("components", "src/components", [leaf("Button.tsx", "src/components/Button.tsx")]),
    ]);
    const result = collapseNode(node);
    expect(result.name).toBe("src/components");
    expect(result.path).toBe("src/components");
    expect(result.isDir).toBe(true);
    expect(result.children).toHaveLength(1);
    expect(result.children[0].name).toBe("Button.tsx");
  });

  it("does not collapse directory with multiple children", () => {
    const node = dir("src", "src", [
      leaf("a.ts", "src/a.ts"),
      leaf("b.ts", "src/b.ts"),
    ]);
    const result = collapseNode(node);
    expect(result.name).toBe("src");
    expect(result.children).toHaveLength(2);
  });

  it("does not collapse when single child is a file", () => {
    const node = dir("src", "src", [leaf("index.ts", "src/index.ts")]);
    const result = collapseNode(node);
    expect(result.name).toBe("src");
    expect(result.children).toHaveLength(1);
  });

  it("collapses deeply nested single-child chain", () => {
    // a -> b -> c -> file.ts
    const node = dir("a", "a", [
      dir("b", "a/b", [
        dir("c", "a/b/c", [leaf("file.ts", "a/b/c/file.ts")]),
      ]),
    ]);
    const result = collapseNode(node);
    expect(result.name).toBe("a/b/c");
    expect(result.path).toBe("a/b/c");
  });

  it("returns leaf as-is", () => {
    const node = leaf("file.ts", "file.ts");
    const result = collapseNode(node);
    expect(result).toEqual(node);
  });
});

/* ── sortTreeNodes ── */

describe("sortTreeNodes", () => {
  it("places directories before files", () => {
    const nodes: FileTreeNode[] = [
      leaf("z.ts", "z.ts"),
      dir("a", "a", []),
    ];
    const result = sortTreeNodes(nodes);
    expect(result[0].name).toBe("a");
    expect(result[1].name).toBe("z.ts");
  });

  it("sorts alphabetically within same type", () => {
    const nodes: FileTreeNode[] = [
      leaf("c.ts", "c.ts"),
      leaf("a.ts", "a.ts"),
      leaf("b.ts", "b.ts"),
    ];
    const result = sortTreeNodes(nodes);
    expect(result.map((n) => n.name)).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("sorts nested children recursively", () => {
    const nodes: FileTreeNode[] = [
      dir("src", "src", [
        leaf("z.ts", "src/z.ts"),
        leaf("a.ts", "src/a.ts"),
      ]),
    ];
    const result = sortTreeNodes(nodes);
    expect(result[0].children.map((n) => n.name)).toEqual(["a.ts", "z.ts"]);
  });
});

/* ── buildFileTree ── */

describe("buildFileTree", () => {
  it("returns empty array for no files", () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it("builds flat list for root-level files", () => {
    const tree = buildFileTree([fd("a.ts"), fd("b.ts")]);
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("a.ts");
    expect(tree[0].isDir).toBe(false);
    expect(tree[1].name).toBe("b.ts");
  });

  it("builds nested directory structure", () => {
    const tree = buildFileTree([
      fd("src/components/Button.tsx"),
      fd("src/components/Input.tsx"),
      fd("src/index.ts"),
    ]);
    // src is root dir
    expect(tree).toHaveLength(1);
    expect(tree[0].isDir).toBe(true);
    expect(tree[0].name).toBe("src");
    // src has two children: components dir + index.ts file
    expect(tree[0].children).toHaveLength(2);
    // dir first, then file
    expect(tree[0].children[0].name).toBe("components");
    expect(tree[0].children[0].isDir).toBe(true);
    expect(tree[0].children[1].name).toBe("index.ts");
  });

  it("collapses single-child directories", () => {
    const tree = buildFileTree([fd("src/utils/helpers/format.ts")]);
    // src/utils/helpers should be collapsed into one node
    expect(tree).toHaveLength(1);
    expect(tree[0].isDir).toBe(true);
    expect(tree[0].name).toBe("src/utils/helpers");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("format.ts");
  });

  it("preserves fileDiff references", () => {
    const file = fd("README.md");
    const tree = buildFileTree([file]);
    expect(tree[0].fileDiff).toBe(file);
  });

  it("handles shared directory prefixes", () => {
    const tree = buildFileTree([
      fd("src/a.ts"),
      fd("src/b.ts"),
      fd("lib/c.ts"),
    ]);
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.name).sort()).toEqual(["lib", "src"]);
  });
});

/* ── buildPathTree ── */

describe("buildPathTree", () => {
  it("returns empty array for no paths", () => {
    expect(buildPathTree([])).toEqual([]);
  });

  it("builds tree from paths", () => {
    const tree = buildPathTree(["docs/guide.md", "docs/api.md"]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("docs");
    expect(tree[0].children).toHaveLength(2);
  });

  it("does not attach fileDiff", () => {
    const tree = buildPathTree(["a.md"]);
    expect(tree[0].fileDiff).toBeUndefined();
  });

  it("collapses single-child dirs same as buildFileTree", () => {
    const tree = buildPathTree(["a/b/c/file.md"]);
    expect(tree[0].name).toBe("a/b/c");
  });
});

/* ── flattenTree ── */

describe("flattenTree", () => {
  const tree: FileTreeNode[] = [
    dir("src", "src", [
      dir("components", "src/components", [
        leaf("Button.tsx", "src/components/Button.tsx"),
        leaf("Input.tsx", "src/components/Input.tsx"),
      ]),
      leaf("index.ts", "src/index.ts"),
    ]),
    leaf("README.md", "README.md"),
  ];

  it("flattens all nodes when nothing is collapsed", () => {
    const flat = flattenTree(tree, new Set());
    expect(flat).toHaveLength(6);
    expect(flat.map((f) => f.node.name)).toEqual([
      "src",
      "components",
      "Button.tsx",
      "Input.tsx",
      "index.ts",
      "README.md",
    ]);
  });

  it("assigns correct depth", () => {
    const flat = flattenTree(tree, new Set());
    expect(flat.map((f) => f.depth)).toEqual([0, 1, 2, 2, 1, 0]);
  });

  it("skips children of collapsed directories", () => {
    const collapsed = new Set(["src/components"]);
    const flat = flattenTree(tree, collapsed);
    // src, components (collapsed - no children), index.ts, README.md
    expect(flat).toHaveLength(4);
    expect(flat.map((f) => f.node.name)).toEqual([
      "src",
      "components",
      "index.ts",
      "README.md",
    ]);
  });

  it("collapses root directory", () => {
    const collapsed = new Set(["src"]);
    const flat = flattenTree(tree, collapsed);
    // src (collapsed), README.md
    expect(flat).toHaveLength(2);
    expect(flat.map((f) => f.node.name)).toEqual(["src", "README.md"]);
  });

  it("returns empty array for empty tree", () => {
    expect(flattenTree([], new Set())).toEqual([]);
  });

  it("handles all collapsed", () => {
    const collapsed = new Set(["src", "src/components"]);
    const flat = flattenTree(tree, collapsed);
    expect(flat).toHaveLength(2);
  });
});
