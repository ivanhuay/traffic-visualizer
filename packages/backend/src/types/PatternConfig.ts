export type Pattern = {
  to: string;
  match: string;
  pathPattern?: string;
};

export type ServicePatterns = {
  service: string;
  patterns: Pattern[];
  errorPatterns?: string[];
};

export type PatternConfig = ServicePatterns[];
