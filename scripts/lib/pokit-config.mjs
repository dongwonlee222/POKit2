import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PROJECT = Object.freeze({
  key: 'common',
  name: 'common',
  prefix: 'COM',
});

export const DEFAULT_POKIT_CONFIG = Object.freeze({
  locale: 'ko-KR',
  automation: Object.freeze({
    modelTier: 'standard',
    pushPolicy: 'confirm',
  }),
});

const SECRET_KEY_PATTERN = /(?:^|[_-])(?:api[_-]?key|token|secret|password|db[_-]?url|database[_-]?url|private[_-]?key)(?:[_-]|$)|(?:apiKey|accessToken|refreshToken|clientSecret|privateKey|databaseUrl|dbUrl)$/i;

export function defaultPokitHome(env = process.env) {
  return env.POKIT_HOME ?? path.join(os.homedir(), '.pokit');
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePrefix(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function normalizeProject(project, fallback = DEFAULT_PROJECT) {
  const key = normalizeKey(project?.key ?? fallback.key);
  const name = String(project?.name ?? key ?? fallback.name).trim();
  const prefix = normalizePrefix(project?.prefix ?? fallback.prefix);
  if (!key || !name || !/^[A-Z][A-Z0-9]{1,5}$/.test(prefix)) return { ...fallback };
  return { key, name, prefix };
}

async function readJsonOptional(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

async function readTextOptional(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return '';
    throw err;
  }
}

export function parseDotEnv(text) {
  const values = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function settingsFromConfig(config) {
  const settings = config?.settings ?? {};
  const defaults = config?.defaults ?? {};
  return {
    locale: settings.locale ?? config?.default_locale ?? defaults.locale ?? defaults.default_locale,
    modelTier: settings.model_tier ?? settings.modelTier ?? defaults.model_tier ?? defaults.modelTier,
    pushPolicy: settings.push_policy ?? settings.pushPolicy ?? defaults.push_policy ?? defaults.pushPolicy,
  };
}

function projectFromConfig(config, fallback = DEFAULT_PROJECT) {
  const defaults = config?.defaults ?? {};
  const explicitDefault = defaults.default_project;
  if (explicitDefault && typeof explicitDefault === 'object') {
    return normalizeProject(explicitDefault, fallback);
  }
  if (config?.default_project && typeof config.default_project === 'object') {
    return normalizeProject(config.default_project, fallback);
  }
  const projectKey = normalizeKey(config?.default_project ?? explicitDefault);
  const projects = Array.isArray(config?.projects) ? config.projects : [];
  const matched = projects.find((project) => normalizeKey(project?.key) === projectKey);
  return matched ? normalizeProject(matched, fallback) : fallback;
}

function projectFromEnv(env, fallback) {
  if (!env.POKIT_DEFAULT_PROJECT_KEY && !env.POKIT_DEFAULT_PROJECT_NAME && !env.POKIT_DEFAULT_PROJECT_PREFIX) {
    return fallback;
  }
  return normalizeProject({
    key: env.POKIT_DEFAULT_PROJECT_KEY ?? fallback.key,
    name: env.POKIT_DEFAULT_PROJECT_NAME ?? fallback.name,
    prefix: env.POKIT_DEFAULT_PROJECT_PREFIX ?? fallback.prefix,
  }, fallback);
}

function collectSecrets(...envLayers) {
  const secrets = {};
  for (const layer of envLayers) {
    for (const [key, value] of Object.entries(layer ?? {})) {
      if (key.startsWith('POKIT_') && SECRET_KEY_PATTERN.test(key)) secrets[key] = value;
    }
  }
  return secrets;
}

export function assertPublicConfigHasNoSecrets(value, sourcePath = 'config') {
  function visit(node, keyPath) {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const nextPath = [...keyPath, key];
      if (SECRET_KEY_PATTERN.test(key)) {
        throw new Error(`secret-like key ${nextPath.join('.')} must not be stored in ${sourcePath}`);
      }
      visit(child, nextPath);
    }
  }
  visit(value, []);
}

export async function resolvePokitConfig(root, {
  env = process.env,
  homeDir = defaultPokitHome(env),
} = {}) {
  const projectConfigPath = path.join(root, '.pokit/config.json');
  const projectEnvPath = path.join(root, '.pokit/.env');
  const globalConfigPath = path.join(homeDir, 'config.json');

  const globalConfig = await readJsonOptional(globalConfigPath);
  const projectConfig = await readJsonOptional(projectConfigPath);
  if (globalConfig) assertPublicConfigHasNoSecrets(globalConfig, '~/.pokit/config.json');
  if (projectConfig) assertPublicConfigHasNoSecrets(projectConfig, '.pokit/config.json');

  const projectEnv = parseDotEnv(await readTextOptional(projectEnvPath));
  const globalSettings = settingsFromConfig(globalConfig);
  const projectSettings = settingsFromConfig(projectConfig);

  const globalDefaultProject = projectFromConfig(globalConfig, DEFAULT_PROJECT);
  const projectDefaultProject = projectFromConfig(projectConfig, globalDefaultProject);
  const envDefaultProject = projectFromEnv({ ...projectEnv, ...env }, projectDefaultProject);

  return {
    root,
    homeDir,
    defaultProject: envDefaultProject,
    locale: env.POKIT_LOCALE ?? projectEnv.POKIT_LOCALE ?? projectSettings.locale ?? globalSettings.locale ?? DEFAULT_POKIT_CONFIG.locale,
    automation: {
      modelTier: env.POKIT_MODEL_TIER ?? projectEnv.POKIT_MODEL_TIER ?? projectSettings.modelTier ?? globalSettings.modelTier ?? DEFAULT_POKIT_CONFIG.automation.modelTier,
      pushPolicy: env.POKIT_PUSH_POLICY ?? projectEnv.POKIT_PUSH_POLICY ?? projectSettings.pushPolicy ?? globalSettings.pushPolicy ?? DEFAULT_POKIT_CONFIG.automation.pushPolicy,
    },
    secrets: collectSecrets(projectEnv, env),
    sources: {
      processEnv: true,
      projectEnvPath,
      projectConfigPath,
      globalConfigPath,
    },
  };
}

export function resolvePackageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export async function readPokitPackageVersion(packageRoot = resolvePackageRoot()) {
  const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

export async function ensurePokitSecretGitignore(root) {
  const gitignorePath = path.join(root, '.gitignore');
  const currentText = await readTextOptional(gitignorePath);
  const required = [
    '.pokit/.env',
    '.pokit/.env.*',
    '!.pokit/.env.example',
    '.pokit/sessions/',
    '.pokit/locks/',
    '.pokit/project-state.json',
    '.pokit/seq.json',
    '.pokit/current.md',
    '.pokit/handoff.md',
  ];
  const lines = currentText.split(/\r?\n/).filter((line) => line.trim() !== '.pokit/');
  const existing = new Set(lines.map((line) => line.trim()));
  for (const entry of required) {
    if (!existing.has(entry)) lines.push(entry);
  }
  const nextText = `${lines.filter((line, index, array) => line !== '' || index < array.length - 1).join('\n')}\n`;
  if (nextText !== currentText) {
    await mkdir(path.dirname(gitignorePath), { recursive: true });
    await writeFile(gitignorePath, nextText, 'utf8');
    return { changed: true, path: gitignorePath };
  }
  return { changed: false, path: gitignorePath };
}
