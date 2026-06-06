import type { Node, Parser, Tree } from "web-tree-sitter";

// AST extraction for the M1 indexer. Replaces the regex extraction in
// lib/repo-graph/symbols.ts (kept until the canvas switches to /api/kb/*).
// Raw symbol kinds here are DB values; the payload-only "component"/"default"
// distinction is re-derived at serve time (see serve.ts / classify()).

export type ParsedSymbol = {
  name: string;
  /** Raw kind: function | class | interface | type | enum | const | default */
  kind: string;
  startLine: number; // 1-indexed
  endLine: number; // 1-indexed
  /** Parameter list text without outer parens, when applicable. */
  signature: string | null;
  exported: boolean;
  stableKey: string; // `${path}::${name}`
  /** Byte span of the whole declaration statement — call containment. */
  startIndex: number;
  endIndex: number;
};

export type ImportBinding = {
  localName: string;
  /** Exported name in the target file; "default" for default imports. */
  importedName: string;
  specifier: string;
};

export type NamespaceBinding = {
  localName: string; // `import * as ns` → "ns"
  specifier: string;
};

export type CallRef = {
  /** stableKey of the enclosing top-level symbol. */
  fromKey: string;
  /** Bare callee: `foo()`, `new Foo()`, `<Foo />`. */
  calleeName?: string;
  /** Member callee on a namespace import: `ns.foo()`. */
  namespaceObject?: string;
  namespaceProperty?: string;
};

export type ParsedFile = {
  symbols: ParsedSymbol[];
  /** Every import/require/re-export specifier (file→file edges). */
  specifiers: string[];
  bindings: ImportBinding[];
  namespaces: NamespaceBinding[];
  calls: CallRef[];
};

function paramsText(decl: Node): string | null {
  const params = decl.childForFieldName("parameters");
  if (!params) return null;
  const text = params.text;
  // strip outer parens to match the old payload `params` shape
  return text.startsWith("(") && text.endsWith(")")
    ? text.slice(1, -1).trim()
    : text.trim();
}

function stringLiteralValue(node: Node | null): string | null {
  if (!node || node.type !== "string") return null;
  const frag = node.namedChildren.find((c) => c.type === "string_fragment");
  if (frag) return frag.text;
  // empty string literal has no fragment
  const text = node.text;
  return text.length >= 2 ? text.slice(1, -1) : null;
}

export function parseFile(
  parser: Parser,
  filePath: string,
  src: string,
): ParsedFile | null {
  const tree: Tree | null = parser.parse(src);
  if (!tree) return null;
  try {
    return extract(tree, filePath);
  } finally {
    tree.delete(); // free wasm-side memory; we parse hundreds of files per run
  }
}

function extract(tree: Tree, filePath: string): ParsedFile {
  const root = tree.rootNode;
  const symbols: ParsedSymbol[] = [];
  const seenKeys = new Set<string>();
  const specifiers: string[] = [];
  const seenSpecs = new Set<string>();
  const bindings: ImportBinding[] = [];
  const namespaces: NamespaceBinding[] = [];
  const calls: CallRef[] = [];

  const pushSymbol = (
    name: string,
    kind: string,
    declNode: Node,
    containerNode: Node,
    exported: boolean,
    signature: string | null,
  ) => {
    const stableKey = `${filePath}::${name}`;
    if (seenKeys.has(stableKey)) return;
    seenKeys.add(stableKey);
    symbols.push({
      name,
      kind,
      startLine: containerNode.startPosition.row + 1,
      endLine: containerNode.endPosition.row + 1,
      signature,
      exported,
      stableKey,
      startIndex: containerNode.startIndex,
      endIndex: containerNode.endIndex,
    });
  };

  const pushSpecifier = (spec: string | null) => {
    if (!spec || seenSpecs.has(spec)) return;
    seenSpecs.add(spec);
    specifiers.push(spec);
  };

  // --- top-level declarations -------------------------------------------
  const handleDeclaration = (
    decl: Node,
    container: Node,
    exported: boolean,
    isDefault: boolean,
  ) => {
    switch (decl.type) {
      case "function_declaration":
      case "generator_function_declaration": {
        const name = decl.childForFieldName("name")?.text;
        pushSymbol(
          name ?? "default",
          isDefault ? "default" : "function",
          decl,
          container,
          exported,
          paramsText(decl),
        );
        break;
      }
      case "class_declaration":
      case "abstract_class_declaration": {
        const name = decl.childForFieldName("name")?.text;
        pushSymbol(
          name ?? "default",
          name ? "class" : "default",
          decl,
          container,
          exported,
          null,
        );
        break;
      }
      case "interface_declaration":
      case "type_alias_declaration":
      case "enum_declaration": {
        const name = decl.childForFieldName("name")?.text;
        if (!name) break;
        const kind =
          decl.type === "interface_declaration"
            ? "interface"
            : decl.type === "type_alias_declaration"
              ? "type"
              : "enum";
        pushSymbol(name, kind, decl, container, exported, null);
        break;
      }
      case "lexical_declaration":
      case "variable_declaration": {
        for (const declarator of decl.namedChildren) {
          if (declarator.type !== "variable_declarator") continue;
          const nameNode = declarator.childForFieldName("name");
          if (nameNode?.type !== "identifier") continue; // skip destructuring
          const value = declarator.childForFieldName("value");
          const isFn =
            value?.type === "arrow_function" ||
            value?.type === "function_expression" ||
            value?.type === "generator_function";
          pushSymbol(
            nameNode.text,
            isFn ? "function" : "const",
            declarator,
            container,
            exported,
            isFn && value ? paramsText(value) : null,
          );
        }
        break;
      }
      default:
        break; // ambient/namespace/etc. — not surfaced in v1
    }
  };

  for (const stmt of root.namedChildren) {
    if (stmt.type === "import_statement") {
      pushSpecifier(stringLiteralValue(stmt.childForFieldName("source")));
      const clause = stmt.namedChildren.find(
        (c) => c.type === "import_clause",
      );
      const spec = stringLiteralValue(stmt.childForFieldName("source"));
      if (clause && spec) {
        for (const part of clause.namedChildren) {
          if (part.type === "identifier") {
            bindings.push({
              localName: part.text,
              importedName: "default",
              specifier: spec,
            });
          } else if (part.type === "namespace_import") {
            const ident = part.namedChildren.find(
              (c) => c.type === "identifier",
            );
            if (ident) namespaces.push({ localName: ident.text, specifier: spec });
          } else if (part.type === "named_imports") {
            for (const s of part.namedChildren) {
              if (s.type !== "import_specifier") continue;
              const name = s.childForFieldName("name")?.text;
              const alias = s.childForFieldName("alias")?.text;
              if (!name) continue;
              bindings.push({
                localName: alias ?? name,
                importedName: name,
                specifier: spec,
              });
            }
          }
        }
      }
      continue;
    }

    if (stmt.type === "export_statement") {
      // `export … from "x"` re-exports are import edges too
      pushSpecifier(stringLiteralValue(stmt.childForFieldName("source")));
      const isDefault = stmt.children.some((c) => c?.type === "default");
      const decl = stmt.childForFieldName("declaration");
      if (decl) {
        handleDeclaration(decl, stmt, true, isDefault);
      } else if (isDefault) {
        const value = stmt.childForFieldName("value");
        if (value?.type === "identifier") {
          // `export default foo` — foo is declared elsewhere; skip, the
          // declaration itself was/will be captured.
        } else if (value) {
          pushSymbol("default", "default", value, stmt, true, null);
        }
      }
      continue;
    }

    handleDeclaration(stmt, stmt, false, false);
  }

  // --- full-tree walk: dynamic imports, require, call sites --------------
  const sortedSymbols = [...symbols].sort((a, b) => a.startIndex - b.startIndex);
  const enclosing = (index: number): ParsedSymbol | null => {
    for (const s of sortedSymbols) {
      if (index >= s.startIndex && index <= s.endIndex) return s;
      if (s.startIndex > index) break; // top-level spans don't overlap
    }
    return null;
  };

  const pushCall = (
    index: number,
    ref: Omit<CallRef, "fromKey">,
  ) => {
    const owner = enclosing(index);
    if (!owner) return;
    calls.push({ fromKey: owner.stableKey, ...ref });
  };

  const visit = (node: Node) => {
    switch (node.type) {
      case "call_expression": {
        const fn = node.childForFieldName("function");
        if (fn?.type === "identifier") {
          if (fn.text === "require") {
            pushSpecifier(stringLiteralValue(firstStringArg(node)));
          } else {
            pushCall(node.startIndex, { calleeName: fn.text });
          }
        } else if (fn?.type === "import") {
          // dynamic import()
          pushSpecifier(stringLiteralValue(firstStringArg(node)));
        } else if (fn?.type === "member_expression") {
          const obj = fn.childForFieldName("object");
          const prop = fn.childForFieldName("property");
          if (obj?.type === "identifier" && prop) {
            pushCall(node.startIndex, {
              namespaceObject: obj.text,
              namespaceProperty: prop.text,
            });
          }
        }
        break;
      }
      case "new_expression": {
        const ctor = node.childForFieldName("constructor");
        if (ctor?.type === "identifier") {
          pushCall(node.startIndex, { calleeName: ctor.text });
        }
        break;
      }
      case "jsx_opening_element":
      case "jsx_self_closing_element": {
        const name = node.childForFieldName("name");
        if (name?.type === "identifier" && /^[A-Z]/.test(name.text)) {
          pushCall(node.startIndex, { calleeName: name.text });
        }
        break;
      }
      default:
        break;
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(root);

  return {
    symbols: symbols.sort((a, b) => a.startLine - b.startLine),
    specifiers,
    bindings,
    namespaces,
    calls,
  };
}

function firstStringArg(callNode: Node): Node | null {
  const args = callNode.childForFieldName("arguments");
  if (!args) return null;
  return args.namedChildren.find((c) => c.type === "string") ?? null;
}
