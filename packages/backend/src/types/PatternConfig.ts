export type Pattern = {
  to: string;
  match: string;
};

export type ServicePatterns = {
  service: string;
  patterns: Pattern[];
  errorPatterns?: string[];
};

export type PatternConfig = ServicePatterns[];
