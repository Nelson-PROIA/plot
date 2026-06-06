import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-tree-sitter must stay unbundled: its CJS build locates
  // web-tree-sitter.wasm relative to __dirname at runtime.
  serverExternalPackages: ["web-tree-sitter"],
  // Make sure the WASM binaries reach the deployed function bundle.
  // Keyed /api/** (not per-route) so the M1 indexer routes inherit them.
  outputFileTracingIncludes: {
    "/api/**": [
      "node_modules/web-tree-sitter/web-tree-sitter.wasm",
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm",
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm",
      "node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm",
    ],
  },
};

export default nextConfig;
