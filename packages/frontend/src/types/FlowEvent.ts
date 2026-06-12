export type FlowEvent = {
  from: string;
  to: string;
  timestamp: number;
  requestId?: string;
  correlationId?: string;
  path?: string;
  isError?: boolean;
};
