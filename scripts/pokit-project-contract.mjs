import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const REGISTRY_PATH = '.ai-os/projects.yaml';
export const CURRENT_PATH = '.ai-os/current.md';
export const ISSUE_ID_PATTERN = /^[A-Z][A-Z0-9]*-\d{3,}$/;

export function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        parsed[key] = next;
        index += 1;
      } else {
        parsed[key] = true;
      }
    } else if (!parsed._) {
      parsed._ = [arg];
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

export async function readRegistry(root) {
  const text = await readFile(path.join(root, REGISTRY_PATH), 'utf8');
  const projects = [];
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('- key:')) {
      current = { key: line.slice('- key:'.length).trim() };
      projects.push(current);
    } else if (current) {
      const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      current[key] = key === 'next_number' ? Number(value) : value.replace(/^["']|["']$/g, '');
    }
  }
  return { projects };
}

export async function writeRegistry(root, registry) {
  const lines = [
    '# POKit2 starter project registry',
    '# Each project owns its namespace and issue number counter.',
    'projects:',
  ];
  for (const project of registry.projects) {
    lines.push(
      `  - key: ${project.key}`,
      `    name: ${project.name}`,
      `    namespace: ${project.namespace}`,
      `    next_number: ${Number(project.next_number)}`,
    );
  }
  await writeFile(path.join(root, REGISTRY_PATH), `${lines.join('\n')}\n`, 'utf8');
}

export async function readCurrent(root) {
  const text = await readFile(path.join(root, CURRENT_PATH), 'utf8');
  return { text, frontmatter: parseFrontmatter(text) };
}

export async function updateCurrent(root, updates) {
  const { text, frontmatter } = await readCurrent(root);
  const next = { ...frontmatter, ...updates };
  const end = text.indexOf('\n---', 4);
  const body = end === -1 ? '' : text.slice(end + '\n---'.length);
  const frontmatterText = Object.entries(next)
    .map(([key, value]) => `${key}: ${value === null ? 'null' : value}`)
    .join('\n');
  await writeFile(path.join(root, CURRENT_PATH), `---\n${frontmatterText}\n---${body}`, 'utf8');
}

export async function syncStarterStateViews(root) {
  const [{ frontmatter }, registry, issues] = await Promise.all([
    readCurrent(root),
    readRegistry(root),
    listIssueFiles(root),
  ]);
  const activeProject = registry.projects.find((project) => project.key === frontmatter.active_project) ?? null;
  const activeIssue = frontmatter.active_issue ?? null;
  const activeFound = activeIssue ? issues.find((issue) => issue.id === activeIssue) : null;
  const gateState = frontmatter.gate_state ?? 'idle';
  const nextAction = frontmatter.next_action ?? defaultNextAction(activeProject?.key ?? frontmatter.active_project ?? 'common');

  await Promise.all([
    writeStatusBoard(root, { activeProject, activeIssue, activeFound, gateState, nextAction }),
    writeIssueIndex(root, issues),
    writeStarterHandoff(root, { frontmatter, activeProject, activeIssue, gateState, nextAction }),
  ]);
}

export async function ensureWorkReadOrderEntry(root, relativePath) {
  const currentFile = path.join(root, CURRENT_PATH);
  const text = await readFile(currentFile, 'utf8');
  if (text.includes(`\`${relativePath}\``)) return;

  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === '## work_read_order');
  if (start === -1) return;

  let insertAt = -1;
  let nextNumber = 1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ') && index > start + 1) break;
    const match = lines[index].match(/^(\d+)\.\s+`[^`]+`/);
    if (match) {
      insertAt = index + 1;
      nextNumber = Number(match[1]) + 1;
    }
  }
  if (insertAt === -1) return;
  lines.splice(insertAt, 0, `${nextNumber}. \`${relativePath}\``);
  await writeFile(currentFile, lines.join('\n'), 'utf8');
}

export function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    const raw = field[2].trim();
    result[field[1]] = raw === 'null' ? null : raw.replace(/^["']|["']$/g, '');
  }
  return result;
}

export async function getActiveProject(root) {
  const [{ frontmatter }, registry] = await Promise.all([readCurrent(root), readRegistry(root)]);
  const key = frontmatter.active_project ?? 'common';
  const project = registry.projects.find((entry) => entry.key === key);
  if (!project) throw new Error(`Unknown active project: ${key}`);
  return project;
}

export function validateProjectKey(key) {
  if (!/^[a-z][a-z0-9-]*$/.test(key ?? '')) {
    throw new Error('Project key must use lowercase letters, numbers, and hyphens.');
  }
}

export function validateNamespace(namespace) {
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(namespace ?? '')) {
    throw new Error('Namespace must use 2-10 uppercase letters or numbers.');
  }
}

export function formatIssueId(namespace, number) {
  return `${namespace}-${String(number).padStart(3, '0')}`;
}

export function issueDirForProject(root, projectKey) {
  return path.join(root, 'projects', projectKey, 'issues');
}

export function issuePathForProject(root, projectKey, issueId) {
  return path.join(issueDirForProject(root, projectKey), `${issueId}.md`);
}

export async function findIssue(root, issueId) {
  if (!ISSUE_ID_PATTERN.test(issueId ?? '')) throw new Error(`Invalid issue id: ${issueId}`);
  const registry = await readRegistry(root);
  for (const project of registry.projects) {
    const relativePath = `projects/${project.key}/issues/${issueId}.md`;
    try {
      await access(path.join(root, relativePath));
      return { project, relativePath };
    } catch {}
  }
  const legacyPath = `.ai-os/${issueId}.md`;
  try {
    await access(path.join(root, legacyPath));
    return { project: null, relativePath: legacyPath };
  } catch {}
  return null;
}

export async function listIssueFiles(root) {
  const registry = await readRegistry(root);
  const files = [];
  for (const project of registry.projects) {
    const dir = path.join(root, 'projects', project.key, 'issues');
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && ISSUE_ID_PATTERN.test(entry.name.replace(/\.md$/, ''))) {
        const relativePath = `projects/${project.key}/issues/${entry.name}`;
        const text = await readFile(path.join(root, relativePath), 'utf8');
        const frontmatter = parseFrontmatter(text);
        const issueId = entry.name.replace(/\.md$/, '');
        files.push({
          id: issueId,
          project,
          title: frontmatter.title ?? issueId,
          status: frontmatter.status ?? frontmatter.gate_state ?? 'unknown',
          relativePath,
        });
      }
    }
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function ensureProjectFolders(root, key) {
  await Promise.all([
    mkdir(path.join(root, 'projects', key, 'issues'), { recursive: true }),
    mkdir(path.join(root, 'docs', key), { recursive: true }),
    mkdir(path.join(root, 'artifacts', key), { recursive: true }),
  ]);
}

function defaultNextAction(projectKey) {
  return `Create the first ${projectKey} issue with node scripts/pokit-issue-create.mjs --title <title>`;
}

async function writeStatusBoard(root, { activeProject, activeIssue, activeFound, gateState, nextAction }) {
  const projectLabel = activeProject
    ? `${activeProject.key} (${activeProject.namespace})`
    : 'unknown';
  const issueLabel = activeIssue
    ? `${activeIssue}${activeFound?.title ? ` — ${activeFound.title}` : ''}`
    : 'none';
  const lines = [
    '# Status Board',
    '',
    'Current layer: L1 Starter Bootstrap',
    `Current project: ${projectLabel}`,
    `Current issue: ${issueLabel}`,
    `Gate state: ${gateState}`,
    `Next action: ${nextAction}`,
    '',
    '## PO Hierarchy',
    '',
    'Project -> Harness Issue -> Subtask result -> Gate evidence',
    '',
    'The `common` project is the beginner-safe default. Add your own project when you want a separate namespace and issue counter.',
    '',
  ];
  await writeFile(path.join(root, '.ai-os/status-board.md'), lines.join('\n'), 'utf8');
}

async function writeIssueIndex(root, issues) {
  const lines = [
    '# Issue Index',
    '',
    '| Issue | Project | Title | Status | Path |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const issue of issues) {
    lines.push(`| ${issue.id} | ${issue.project.key} | ${issue.title} | ${issue.status} | \`${issue.relativePath}\` |`);
  }
  if (issues.length === 0) {
    lines.push('', 'No work issue exists yet. The default `common` project will create `COM-001` first.');
  }
  lines.push('');
  await writeFile(path.join(root, '.ai-os/issue-index.md'), lines.join('\n'), 'utf8');
}

async function writeStarterHandoff(root, { frontmatter, activeProject, activeIssue, gateState, nextAction }) {
  const projectLabel = activeProject?.key ?? frontmatter.active_project ?? 'unknown';
  const lines = [
    '# Handoff',
    '',
    '## Active Snapshot',
    '',
    `- active_project: ${projectLabel}`,
    `- active_issue: ${activeIssue ?? 'none'}`,
    `- gate_state: ${gateState}`,
    `- active_sprint: ${frontmatter.active_sprint ?? 'v0.1.0-starter'}`,
    '',
    `Next action: ${nextAction}`,
    '',
    '## Session Notes',
    '',
    '- Starter state views are generated from `.ai-os/current.md` and `.ai-os/projects.yaml`.',
    '',
  ];
  await mkdir(path.join(root, '.ai-os/memory/session'), { recursive: true });
  await writeFile(path.join(root, '.ai-os/memory/session/handoff.md'), lines.join('\n'), 'utf8');
}
