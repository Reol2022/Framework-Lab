export type StepStatus = "passed" | "failed" | "skipped" | "timed_out";
export type RunStatus = "passed" | "failed" | "partial";
export type ErrorSeverity = "error" | "warning";
export type ErrorConfidence = "high" | "medium" | "low";
export type ErrorTool =
  | "eslint"
  | "sass"
  | "vite"
  | "typescript"
  | "node"
  | "pnpm"
  | "generic";

export interface FrameworkStepConfig {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
  timeout_seconds: number;
  allow_failure: boolean;
}

export interface FrameworkConfig {
  schema_version: "1.0.0";
  framework: {
    id: string;
    name: string;
    source_dir: string;
  };
  package_manager: {
    name: string;
    version: string;
    executable: string;
  };
  stop_on_failure: boolean;
  baseline_steps: FrameworkStepConfig[];
  docs?: {
    sources: DocsSourceConfig[];
  };
  analysis?: {
    typescript?: {
      componentDetection?: {
        sourceGlobs: string[];
        baseTypes: string[];
        publicPackages: string[];
        stylePatterns: string[];
        examplePatterns: string[];
        lifecycleMethods?: string[];
        registrationFunctions?: string[];
      };
    };
    retrieval?: {
      identifierPrefixes?: string[];
      aliases?: Record<string, string[]>;
    };
  };
}

export type DocsMode = "http" | "browser" | "file" | "auto";

export interface DocsSourceConfig {
  id: string;
  mode: DocsMode;
  baseUrl?: string;
  basePath?: string;
  entryPages: string[];
  sourceType?: "official-doc" | "official-example" | "test" | "runtime-record";
}

export interface GitSnapshot {
  commit: string | null;
  dirty: boolean | null;
  changedFiles: string[];
  warnings: string[];
}

export interface EnvironmentRecord {
  capturedAt: string;
  os: {
    platform: string;
    release: string;
    arch: string;
  };
  nodeVersion: string;
  npmVersion: string | null;
  packageManager: {
    name: string;
    configuredVersion: string;
    resolvedVersion: string | null;
    executable: string;
  };
  frameworkLabCommit: string | null;
  warnings: string[];
}

export interface SourceRecord extends GitSnapshot {
  frameworkId: string;
  sourceDir: string;
}

export interface StepRecord {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  status: StepStatus;
  stdoutLog: string;
  stderrLog: string;
  allowFailure: boolean;
  timeoutSeconds: number;
}

export interface BaselineRunRecord {
  schemaVersion: "1.0.0";
  runId: string;
  framework: {
    id: string;
    name: string;
  };
  status: RunStatus;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  environmentFile: string;
  sourceFile: string;
  reportFile: string;
  steps: StepRecord[];
  firstBlockingStep: string | null;
  warnings: string[];
  errorsFile?: "errors.json";
  errorSummary?: ErrorSummary;
  firstBlockingErrorId?: string | null;
}

export interface ErrorEvent {
  id: string;
  parser: string;
  parserVersion: string;
  tool: ErrorTool;
  category: string;
  severity: ErrorSeverity;
  stepId: string;
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
  rule: string | null;
  code: string | null;
  plugin: string | null;
  rawExcerpt: string;
  sourceLog: string;
  fingerprint: string;
  blocking: boolean;
  confidence: ErrorConfidence;
}

export interface ErrorSummary {
  total: number;
  errors: number;
  warnings: number;
  recognized: number;
  unrecognized: number;
  byTool: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface ErrorEventsDocument {
  schemaVersion: "1.0.0";
  runId: string;
  frameworkId: string;
  generatedAt: string;
  summary: ErrorSummary;
  firstBlockingErrorId: string | null;
  events: ErrorEvent[];
}

export interface ErrorParseContext {
  runId: string;
  frameworkId: string;
  stepId: string;
  command: string;
  exitCode: number | null;
  status: StepStatus;
  allowFailure: boolean;
  stdout: string;
  stderr: string;
  stdoutLogPath: string;
  stderrLogPath: string;
  cwd: string;
  sourceRoot: string;
  labRoot: string;
}

export interface ParsedErrorCandidate {
  parser: string;
  parserVersion: string;
  tool: ErrorTool;
  category: string;
  severity: ErrorSeverity;
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
  rule: string | null;
  code: string | null;
  plugin: string | null;
  rawExcerpt: string;
  sourceLog: string;
  confidence: ErrorConfidence;
}

export interface ErrorParser {
  id: string;
  version: string;
  priority: number;
  supports(context: ErrorParseContext): boolean;
  parse(context: ErrorParseContext): ParsedErrorCandidate[];
}

export interface BaselineRunOptions {
  labRoot: string;
  frameworkId: string;
  runId?: string;
  sourceDir?: string;
  dryRun?: boolean;
}

export interface BaselineRunResult {
  runDir: string;
  run: BaselineRunRecord;
  environment: EnvironmentRecord;
  source: SourceRecord;
}
