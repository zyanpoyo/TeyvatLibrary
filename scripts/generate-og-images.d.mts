export interface ParsedOgCliArgs {
  outDir: string;
  siteUrl: string | undefined;
  force: boolean;
  only: string[] | null;
  help: boolean;
}

export function parseArgs(argv?: string[]): ParsedOgCliArgs;
