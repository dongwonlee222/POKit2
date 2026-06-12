import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { defaultPokitHome as resolveDefaultPokitHome } from './pokit-config.mjs';

export const PROJECT_OVERVIEW_SCHEMA_VERSION = '0.1.0';

export function defaultPokitHome() {
  return resolveDefaultPokitHome();
}

function registryDir(homeDir) {
  return path.join(homeDir, 'projects');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function reasonForError(err, label) {
  if (err?.code === 'ENOENT') return `missing ${label}`;
  if (err instanceof SyntaxError) return `invalid ${label}`;
  if (err?.code === 'EACCES' || err?.code === 'EPERM') return `unreadable ${label}`;
  return `unreadable ${label}`;
}

async function readOptionalProjectFile(filePath, label) {
  try {
    return { value: await readJson(filePath), reason: null };
  } catch (err) {
    return { value: null, reason: reasonForError(err, label) };
  }
}

function projectFromConfig(config, key) {
  if (!Array.isArray(config?.projects)) return null;
  return config.projects.find((project) => project?.key === key) ?? null;
}

function mergeProjectIdentity({ registryProject, configProject, activeProject }) {
  return {
    key: normalizeText(activeProject?.key) ?? normalizeText(configProject?.key) ?? normalizeText(registryProject?.key),
    name: normalizeText(activeProject?.name) ?? normalizeText(configProject?.name) ?? normalizeText(registryProject?.name),
    prefix: normalizeText(activeProject?.prefix) ?? normalizeText(configProject?.prefix) ?? normalizeText(registryProject?.prefix),
  };
}

function sortRows(rows) {
  return [...rows].sort((left, right) => {
    const leftKey = left.key ?? '';
    const rightKey = right.key ?? '';
    return leftKey.localeCompare(rightKey);
  });
}

export async function readProjectOverview({ homeDir = defaultPokitHome() } = {}) {
  let homeConfig = null;
  const homeWarnings = [];
  try {
    homeConfig = await readJson(path.join(homeDir, 'config.json'));
  } catch (err) {
    if (err?.code !== 'ENOENT') homeWarnings.push(reasonForError(err, 'home config'));
  }

  let entries;
  try {
    entries = await readdir(registryDir(homeDir), { withFileTypes: true });
  } catch (err) {
    return {
      schema_version: PROJECT_OVERVIEW_SCHEMA_VERSION,
      home_dir: homeDir,
      home_config: homeConfig,
      warnings: [reasonForError(err, 'project registry'), ...homeWarnings],
      rows: [],
    };
  }

  const rows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const registryPath = path.join(registryDir(homeDir), entry.name);
    let registryProject;
    try {
      registryProject = await readJson(registryPath);
    } catch (err) {
      rows.push({
        status: 'degraded',
        key: path.basename(entry.name, '.json'),
        name: null,
        prefix: null,
        path: null,
        active_issue: null,
        gate_state: null,
        next_action: null,
        reasons: [reasonForError(err, 'registry project')],
      });
      continue;
    }

    const projectPath = normalizeText(registryProject?.path);
    const reasons = [];
    let config = null;
    let projectState = null;
    if (!projectPath) {
      reasons.push('missing project path');
    } else {
      const configResult = await readOptionalProjectFile(path.join(projectPath, '.pokit/config.json'), 'project config');
      config = configResult.value;
      if (configResult.reason) reasons.push(configResult.reason);

      const stateResult = await readOptionalProjectFile(path.join(projectPath, '.pokit/project-state.json'), 'project state');
      projectState = stateResult.value;
      if (stateResult.reason) reasons.push(stateResult.reason);
    }

    const activeProjectKey = normalizeText(projectState?.active_project) ?? normalizeText(registryProject?.key);
    const configProject = projectFromConfig(config, activeProjectKey) ?? projectFromConfig(config, registryProject?.key);
    const activeProject = projectFromConfig(config, activeProjectKey);
    const identity = mergeProjectIdentity({ registryProject, configProject, activeProject });

    if (!projectState?.schema_version && projectState) reasons.push('older project state');

    rows.push({
      status: reasons.length === 0 ? 'ok' : 'degraded',
      ...identity,
      path: projectPath,
      active_issue: normalizeText(projectState?.active_issue),
      gate_state: normalizeText(projectState?.gate_state),
      next_action: normalizeText(projectState?.next_action),
      active_project: activeProjectKey,
      reasons,
    });
  }

  return {
    schema_version: PROJECT_OVERVIEW_SCHEMA_VERSION,
    home_dir: homeDir,
    home_config: homeConfig,
    warnings: homeWarnings,
    rows: sortRows(rows),
  };
}

function display(value) {
  return value ?? '-';
}

export function renderProjectOverview(overview) {
  const lines = [
    'Project overview',
    `POKIT_HOME: ${overview.home_dir}`,
  ];
  if (overview.warnings?.length) lines.push(`Warnings: ${overview.warnings.join('; ')}`);
  if (overview.rows.length === 0) {
    lines.push('No registered projects found.');
    return lines.join('\n');
  }

  for (const row of overview.rows) {
    const status = row.status === 'ok' ? 'ok' : `degraded: ${row.reasons.join('; ')}`;
    lines.push([
      `${display(row.key)} (${display(row.prefix)})`,
      display(row.name),
      display(row.path),
      `issue=${display(row.active_issue)}`,
      `gate=${display(row.gate_state)}`,
      `next=${display(row.next_action)}`,
      status,
    ].join(' | '));
  }
  return lines.join('\n');
}
