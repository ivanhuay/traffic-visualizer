export type TopologyNode = string;

export type TopologyConfig = {
  nodes: TopologyNode[];
  edges: [string, string][];
};
