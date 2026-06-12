export type FlowEvent = {
  from: string;
  to: string;
  timestamp: number;
  requestId?: string;
  correlationId?: string;
  isError?: boolean;
};
