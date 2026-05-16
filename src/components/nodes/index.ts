import type { NodeTypes } from "@xyflow/react";
import { IntentNode } from "./IntentNode";
import { ArchitectureNode } from "./ArchitectureNode";
import { ChangeCardNode } from "./ChangeCardNode";
import { AlternativesNode } from "./AlternativesNode";
import { RiskNode } from "./RiskNode";
import { DiffNode } from "./DiffNode";
import { PreviewNode } from "./PreviewNode";

export const nodeTypes: NodeTypes = {
  intent: IntentNode,
  architecture: ArchitectureNode,
  change: ChangeCardNode,
  alternatives: AlternativesNode,
  risk: RiskNode,
  diff: DiffNode,
  preview: PreviewNode,
};
