export type TopologyConfig = {
  nodes: string[];
  edges: [string, string][];
  correlationKeyField?: string;
};
