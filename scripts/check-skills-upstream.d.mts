export interface ParsedSkillsUpstreamCliArgs {
  validateOnly: boolean;
  markSynced: string | null;
  date: string | null;
  from: string | null;
  outputDir: string;
  noWrite: boolean;
  json: boolean;
  help: boolean;
}

export function parseCliArgs(argv: string[]): ParsedSkillsUpstreamCliArgs;
export function runCli(argv?: string[], rootDir?: string): Promise<number>;
