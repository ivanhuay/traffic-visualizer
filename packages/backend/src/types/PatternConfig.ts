export type Pattern = {
  to: string;
  match: string;
  pathPattern?: string;
  logFileName?: string;
};

export type ServicePatterns = {
  service: string;
  patterns: Pattern[];
  errorPatterns?: string[];
  logFile?: string;
  logFileName?: string;
};

export type PatternConfig = ServicePatterns[];
