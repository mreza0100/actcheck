import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Package root: dist/scaffold.js → .. ; src/scaffold.ts → .. — both land at the
// package root, where `schemas/` and `skills/` are bundled (see package.json `files`).
const PACKAGE_ROOT = resolve(__dirname, "..");

/** The directory `actcheck init` scaffolds into, relative to the user's cwd. */
export const WORKSPACE_DIR = ".actcheck";

/** The declaration file the user fills in — the default target of `actcheck check`. */
export const DECLARATION_FILE = "annex-iv.yaml";

/** Default path `actcheck check` validates when no argument is given. */
export const DEFAULT_DECLARATION_PATH = join(WORKSPACE_DIR, DECLARATION_FILE);

const SCHEMA_VERSION_DIR = resolve(
  PACKAGE_ROOT,
  "schemas",
  "annex-iv",
  "v1",
);

/** The bundled actcheck skill (SKILL.md + resources) installed by `init`. */
const SKILL_SOURCE_DIR = resolve(PACKAGE_ROOT, "skills", "actcheck");

/** Agent skill directories `init` prefers, in order, when they already exist. */
const AGENT_SKILL_DIRS = [".claude", ".codex"] as const;

// Files copied verbatim from the bundled package into the user's workspace.
// `from` is the bundled source; `to` is the basename written into .actcheck/.
const COPIED_ASSETS: { from: string; to: string }[] = [
  { from: resolve(SCHEMA_VERSION_DIR, "template.yaml"), to: DECLARATION_FILE },
  { from: resolve(SCHEMA_VERSION_DIR, "schema.yaml"), to: "schema.yaml" },
  {
    from: resolve(SCHEMA_VERSION_DIR, "traceability.yaml"),
    to: "traceability.yaml",
  },
];

function workspaceReadme(): string {
  return `# .actcheck — your EU AI Act Annex IV workspace

This folder was created by \`actcheck init\`. It holds everything you need to
draft and validate your Annex IV technical documentation, offline.

| File | What it is |
| --- | --- |
| \`${DECLARATION_FILE}\` | **The form.** Your declaration — fill this in. Replace every \`FILL:\` marker. |
| \`schema.yaml\` | The machine-readable Annex IV spec your declaration is validated against. |
| \`traceability.yaml\` | Every field mapped to its literal Annex IV clause + EUR-Lex anchor. |

## Steps

1. **(Optional) Draft fast.** In Claude Code, run \`/actcheck fill\` — it drafts
   \`${DECLARATION_FILE}\` from your codebase and asks you to close any gaps.
2. **Fill and verify** every field in \`${DECLARATION_FILE}\`. Replace each \`FILL:\`.
3. **Validate:** \`npx actcheck check\`
4. **Commit this folder** — it is your versioned Annex IV dossier.

> actcheck checks structure and completeness, not legal conformity. You remain
> responsible for the truth of what you declare.
`;
}

export interface ScaffoldResult {
  workspacePath: string;
  created: string[];
}

/**
 * Decide where to install the actcheck skill so an agent can run `/actcheck fill`:
 * an existing `.claude/` or `.codex/` skills dir if the project already uses one,
 * otherwise inside the `.actcheck/` workspace. Returns the dir relative to `cwd`.
 */
export function resolveSkillInstallDir(cwd: string): string {
  for (const agentDir of AGENT_SKILL_DIRS) {
    if (existsSync(resolve(cwd, agentDir))) {
      return join(agentDir, "skills", "actcheck");
    }
  }
  return join(WORKSPACE_DIR, "skills", "actcheck");
}

export type RiskClass = "high" | "limited" | "minimal" | "unacceptable";

export interface ScaffoldOptions {
  force?: boolean;
  /**
   * When set, prepend a `risk_classification:` block to the scaffolded
   * declaration so the provider's regulatory framing is captured up front
   * (Articles 5/6/18). Defaults to no risk_classification block — backward
   * compatible with the byte-identical template scaffolded by older releases.
   */
  riskClass?: RiskClass;
  /**
   * When true, prepend a comment header noting that GPAI providers must also
   * satisfy Annex XI in addition to Annex IV. The Annex XI schema lands later;
   * this flag captures the intent now.
   */
  gpai?: boolean;
}

const RISK_CLASS_TEMPLATES: Record<RiskClass, string> = {
  high: `risk_classification:
  risk_level: high
  use_case_tags:
    - "FILL: pick at least one Annex III tag (e.g. employment_workers_management)"
  prohibited_practices_claimed: []
  placed_on_market: "FILL: YYYY-MM-DD (date system was placed on market)"
`,
  limited: `risk_classification:
  risk_level: limited
  prohibited_practices_claimed: []
`,
  minimal: `risk_classification:
  risk_level: minimal
  prohibited_practices_claimed: []
`,
  unacceptable: `risk_classification:
  risk_level: unacceptable
  prohibited_practices_claimed:
    - "FILL: list the Article 5 practice(s) — this declaration will be REJECTED"
`,
};

const GPAI_HEADER = `# GPAI provider note: in addition to Annex IV (this file), you are required to
# maintain Annex XI technical documentation under Article 53. The Annex XI
# schema is on the actcheck roadmap; track progress at
# https://github.com/mreza0100/actcheck.

`;

/**
 * Scaffold the `.actcheck/` workspace inside `cwd`. Accepts either a legacy
 * boolean `force` argument or an options object — the boolean form is kept so
 * old call sites continue to work, but new callers should pass options.
 */
export function scaffoldWorkspace(
  cwd: string,
  opts: ScaffoldOptions | boolean = {},
): ScaffoldResult {
  const options: ScaffoldOptions =
    typeof opts === "boolean" ? { force: opts } : opts;
  const workspacePath = resolve(cwd, WORKSPACE_DIR);

  if (existsSync(workspacePath) && !options.force) {
    throw new Error(
      `${WORKSPACE_DIR}/ already exists. Re-run with --force to overwrite its files.`,
    );
  }

  mkdirSync(workspacePath, { recursive: true });

  const created: string[] = [];

  for (const asset of COPIED_ASSETS) {
    const dest = join(workspacePath, asset.to);
    copyFileSync(asset.from, dest);
    created.push(join(WORKSPACE_DIR, asset.to));
  }

  if (options.riskClass || options.gpai) {
    const declPath = join(workspacePath, DECLARATION_FILE);
    const original = readFileSync(declPath, "utf-8");
    const header =
      (options.gpai ? GPAI_HEADER : "") +
      (options.riskClass ? RISK_CLASS_TEMPLATES[options.riskClass] : "");
    writeFileSync(declPath, header + original, "utf-8");
  }

  const readmeDest = join(workspacePath, "README.md");
  writeFileSync(readmeDest, workspaceReadme(), "utf-8");
  created.push(join(WORKSPACE_DIR, "README.md"));

  // Install the actcheck skill so `/actcheck fill` is available to the agent.
  const skillRelDir = resolveSkillInstallDir(cwd);
  cpSync(SKILL_SOURCE_DIR, resolve(cwd, skillRelDir), { recursive: true });
  created.push(`${skillRelDir}/`);

  return { workspacePath, created };
}
