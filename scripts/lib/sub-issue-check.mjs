// POK-120-03 Sub-issue validation — full 7-check rewrite.
// Uses parseSubIssues() from sub-issue-schema.mjs (yaml-lite, 0-dep — POK-334).
// Uses VALID_WORKER_TYPES / isValidWorkerType from sub-issue-worker-types.mjs.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseSubIssues, SUB_ISSUE_ID_PATTERN, REQUIRED_FIELDS } from './sub-issue-schema.mjs'
import { isValidWorkerType } from './sub-issue-worker-types.mjs'
import { readActiveIssueForWorktree } from './worktree-active-issue.mjs'
import { parseFrontmatter } from './issue-frontmatter.mjs'

const RETRO_BACKFILL_ISSUES = new Set(['POK-126', 'POK-127', 'POK-128', 'POK-135', 'POK-138'])

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readOptional(root, filePath) {
  try {
    return await readFile(path.join(root, filePath), 'utf8')
  } catch (err) {
    if (err?.code === 'ENOENT') return null
    throw err
  }
}

function pass(check, filePath, message) {
  return { status: 'pass', check, path: filePath, message }
}

function fail(check, filePath, message, next_action) {
  return { status: 'fail', check, path: filePath, message, next_action }
}

function warn(check, filePath, message, next_action) {
  return { status: 'warning', check, path: filePath, message, next_action }
}

// Derive the parent issue ID from a filename like "POK-120.md" → "POK-120"
function parentIdFromFile(name) {
  return name.replace(/\.md$/, '')
}

async function currentActiveIssue(root) {
  try {
    const worktreeActive = await readActiveIssueForWorktree(root)
    if (worktreeActive.activeIssue) return worktreeActive.activeIssue
  } catch {
    // Keep current.md fallback.
  }
  const content = await readOptional(root, '.ai-os/current.md')
  if (content === null) return null
  return parseFrontmatter(content).active_issue ?? null
}

function shouldEnforceDecomposition(issueId, activeIssue, hasCurrentFile, frontmatter) {
  if (!hasCurrentFile) return true
  if (issueId === activeIssue && frontmatter?.gate_state === 'gate_passed') return true
  return RETRO_BACKFILL_ISSUES.has(issueId)
}

// parseFrontmatter imported from ./issue-frontmatter.mjs (POK-339)

function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const startRe = new RegExp(`^##\\s+${escaped}\\s*$`, 'im')
  const start = startRe.exec(content)
  if (!start) return ''

  const sectionStart = start.index + start[0].length
  const rest = content.slice(sectionStart)
  const nextHeading = rest.search(/\n##\s+/)
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading)
}

function countAcceptanceCriteria(content) {
  const section = extractSection(content, 'Acceptance Criteria')
  if (!section) return 0

  const lines = section.split('\n')
  return lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (/^[-*]\s+\[[ xX]\]\s+AC\d+\b/.test(trimmed)) return true
    if (/^[-*]\s+AC\d+\b/.test(trimmed)) return true
    if (/^\d+[.)]\s+/.test(trimmed)) return true
    return false
  }).length
}

function changedLinesValue(frontmatter, content) {
  const values = [
    frontmatter.expected_changed_lines,
    frontmatter.changed_lines,
    frontmatter.actual_changed_lines,
  ]

  for (const value of values) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }

  const bodyMatch = content.match(/\b(?:expected_|actual_)?changed_lines\b\s*(?:>=|≥|:|=)\s*(\d+)/i)
  if (!bodyMatch) return 0
  return Number(bodyMatch[1])
}

function workerTypeCount(content) {
  const types = new Set()
  const re = /^\s*worker_type:\s*["']?([a-z_]+)["']?\s*$/gm
  let match
  while ((match = re.exec(content)) !== null) {
    types.add(match[1])
  }
  return types.size
}

function hasNotRequired(frontmatter, key) {
  return frontmatter[key] === 'not_required'
}

function hasSkipDeclaration(frontmatter) {
  if (hasNotRequired(frontmatter, 'worker_tasks')) {
    return typeof frontmatter.worker_tasks_skip_reason === 'string'
      && frontmatter.worker_tasks_skip_reason.trim().length > 0
  }

  return hasNotRequired(frontmatter, 'sub_issues')
    && typeof frontmatter.sub_issues_skip_reason === 'string'
    && frontmatter.sub_issues_skip_reason.trim().length > 0
}

function hasSubIssueDeclaration(frontmatter, content) {
  if (frontmatter.worker_tasks && frontmatter.worker_tasks !== 'not_required') return true
  if (frontmatter.sub_issues && frontmatter.sub_issues !== 'not_required') return true
  return parseSubIssues(content).length > 0
}

function skipDeclarationKey(frontmatter) {
  if (hasNotRequired(frontmatter, 'worker_tasks')) return 'worker_tasks'
  if (hasNotRequired(frontmatter, 'sub_issues')) return 'sub_issues'
  return null
}

function decompositionDeclarationLabel(content) {
  if (/##\s+Worker Tasks\s*\n/i.test(content)) return '## Worker Tasks'
  if (/##\s+Sub-issues\s*\n/i.test(content)) return 'legacy ## Sub-issues'
  return 'decomposition'
}

function decompositionDeclarationHint() {
  return 'Declare ## Worker Tasks (preferred) or legacy ## Sub-issues, or opt out with frontmatter worker_tasks: not_required plus worker_tasks_skip_reason.'
}

function decompositionReasons(frontmatter, content) {
  const acCount = countAcceptanceCriteria(content)
  const changedLines = changedLinesValue(frontmatter, content)
  const workers = workerTypeCount(content)

  const reasons = []
  if (acCount >= 5) reasons.push(`AC count ${acCount} >= 5`)
  if (changedLines >= 300) reasons.push(`changed_lines ${changedLines} >= 300`)
  if (workers >= 2) reasons.push(`worker_type count ${workers} >= 2`)
  return reasons
}

function isReadOnlyReviewWorkerTask(sub) {
  if (sub.worker_type !== 'review_worker') return false
  if (!Array.isArray(sub.constraints)) return false
  return sub.constraints.some((constraint) => typeof constraint === 'string' && /\bread_only\b/i.test(constraint))
}

// ---------------------------------------------------------------------------
// C1 — YAML parse
// ---------------------------------------------------------------------------

/**
 * C1: checkSubIssueYamlParse
 * Attempts parseSubIssues() on each issue file.
 * - Throws → fail
 * - Section absent → pass (no worker task declaration is valid)
 * - Parses OK → pass
 */
export async function checkSubIssueYamlParse(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    // Quick check: if section is absent, treat as pass (no decomposition required)
    if (!/##\s+(Worker Tasks|Sub-issues)/i.test(content)) {
      results.push(pass('sub_issue_yaml_parse', filePath, 'No ## Worker Tasks (preferred) or legacy ## Sub-issues section — skipped.'))
      continue
    }

    try {
      parseSubIssues(content)
      results.push(pass('sub_issue_yaml_parse', filePath, `${decompositionDeclarationLabel(content)} YAML parses cleanly.`))
    } catch (err) {
      results.push(fail(
        'sub_issue_yaml_parse',
        filePath,
        `${decompositionDeclarationLabel(content)} YAML parse error: ${err.message}`,
        'Fix the YAML syntax in the ## Worker Tasks fenced block; legacy ## Sub-issues remains accepted for old cards.'
      ))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C2 — Required fields
// ---------------------------------------------------------------------------

/**
 * C2: checkSubIssueRequiredFields
 * For each sub-issue object, warns on any REQUIRED_FIELDS that are absent,
 * null, empty string, or empty array.
 */
export async function checkSubIssueRequiredFields(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    let subIssues
    try {
      subIssues = parseSubIssues(content)
    } catch {
      continue // C1 already reports parse failures
    }

    if (subIssues.length === 0) continue

    let fileHasWarning = false
    for (const sub of subIssues) {
      const subId = sub.id ?? '(unknown)'
      const missing = REQUIRED_FIELDS.filter((field) => {
        const val = sub[field]
        if (val === undefined || val === null || val === '') return true
        if (Array.isArray(val) && val.length === 0) return true
        return false
      })

      if (missing.length > 0) {
        fileHasWarning = true
        results.push(warn(
          'sub_issue_required_fields',
          filePath,
          `Sub-issue "${subId}" is missing required fields: ${missing.join(', ')}.`,
          `Add all required fields: ${REQUIRED_FIELDS.join(', ')}.`
        ))
      }
    }

    if (!fileHasWarning) {
      results.push(pass('sub_issue_required_fields', filePath, 'All sub-issues have required fields.'))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C3 — ID format
// ---------------------------------------------------------------------------

/**
 * C3: checkSubIssueIdFormat
 * Each worker task id must match SUB_ISSUE_ID_PATTERN (POK-NNN-WN or legacy POK-NNN-NN).
 * The prefix (POK-NNN) must match the parent issue file (e.g. POK-120.md).
 */
export async function checkSubIssueIdFormat(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    let subIssues
    try {
      subIssues = parseSubIssues(content)
    } catch {
      continue
    }

    if (subIssues.length === 0) continue

    const parentId = parentIdFromFile(name)
    let fileFailed = false

    for (const sub of subIssues) {
      const subId = sub.id ?? '(missing)'

      if (!SUB_ISSUE_ID_PATTERN.test(subId)) {
        fileFailed = true
        results.push(fail(
          'sub_issue_id_format',
          filePath,
          `Worker task id "${subId}" does not match required pattern POK-NNN-WN or legacy POK-NNN-NN.`,
          'Use preferred format POK-NNN-WN where NNN is the parent issue number and WN is the worker task sequence.'
        ))
        continue
      }

      // Check prefix: POK-120-W1 or legacy POK-120-01 must belong to POK-120.md
      const prefix = subId.replace(/-(?:W\d+|\d{2})$/, '')
      if (prefix !== parentId) {
        fileFailed = true
        results.push(fail(
          'sub_issue_id_format',
          filePath,
          `Worker task id "${subId}" prefix "${prefix}" does not match parent issue id "${parentId}".`,
          `Worker task ids in ${name} must start with "${parentId}-".`
        ))
      }
    }

    if (!fileFailed) {
      results.push(pass('sub_issue_id_format', filePath, 'All worker task ids match the required format and parent prefix.'))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C4 — Worker type
// ---------------------------------------------------------------------------

/**
 * C4: checkSubIssueWorkerType
 * Each sub-issue worker_type must be in VALID_WORKER_TYPES.
 */
export async function checkSubIssueWorkerType(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    let subIssues
    try {
      subIssues = parseSubIssues(content)
    } catch {
      continue
    }

    if (subIssues.length === 0) continue

    let fileFailed = false

    for (const sub of subIssues) {
      const subId = sub.id ?? '(unknown)'
      const wt = sub.worker_type

      if (!isValidWorkerType(wt)) {
        fileFailed = true
        results.push(fail(
          'sub_issue_worker_type',
          filePath,
          `Sub-issue "${subId}" has invalid worker_type: "${wt}".`,
          'Use one of: docs_worker, spec_worker, code_worker, cleanup_worker, review_worker, qa_worker.'
        ))
      }
    }

    if (!fileFailed) {
      results.push(pass('sub_issue_worker_type', filePath, 'All sub-issue worker_type values are valid.'))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C5 — allowed_paths content
// ---------------------------------------------------------------------------

/**
 * C5: checkSubIssueAllowedPaths
 * allowed_paths must be a non-empty array of valid path strings.
 * - Empty or missing → fail
 * - Contains glob (* or **) → fail
 * - Ends with / (directory-only) → fail
 */
export async function checkSubIssueAllowedPaths(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    let subIssues
    try {
      subIssues = parseSubIssues(content)
    } catch {
      continue
    }

    if (subIssues.length === 0) continue

    let fileFailed = false

    for (const sub of subIssues) {
      const subId = sub.id ?? '(unknown)'
      const paths = sub.allowed_paths

      if (!Array.isArray(paths) || paths.length === 0) {
        if (isReadOnlyReviewWorkerTask(sub)) {
          results.push(warn(
            'sub_issue_allowed_paths',
            filePath,
            `Review worker task "${subId}" is read-only and has empty allowed_paths.`,
            'Prefer explicit read paths for review_worker tasks; empty allowed_paths is tolerated only for legacy read_only review tasks.'
          ))
          continue
        }
        fileFailed = true
        results.push(fail(
          'sub_issue_allowed_paths',
          filePath,
          `Sub-issue "${subId}" has empty or missing allowed_paths.`,
          'Provide at least one explicit file path in allowed_paths.'
        ))
        continue
      }

      for (const p of paths) {
        if (typeof p !== 'string') continue

        if (p.includes('*')) {
          fileFailed = true
          results.push(fail(
            'sub_issue_allowed_paths',
            filePath,
            `Sub-issue "${subId}" allowed_paths entry "${p}" contains a glob (* or **).`,
            'List explicit file paths; globs are not allowed in allowed_paths.'
          ))
        }

        if (p.endsWith('/')) {
          fileFailed = true
          results.push(fail(
            'sub_issue_allowed_paths',
            filePath,
            `Sub-issue "${subId}" allowed_paths entry "${p}" is a directory path (ends with /).`,
            'Specify individual files, not directories, in allowed_paths.'
          ))
        }
      }
    }

    if (!fileFailed) {
      results.push(pass('sub_issue_allowed_paths', filePath, 'All sub-issue allowed_paths entries are valid.'))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C6 — allowed_paths cross-sub-issue conflict (file-level independent)
// ---------------------------------------------------------------------------

/**
 * C6: checkSubIssueAllowedPathsConflict
 * Within a single issue file, if the same path appears in 2+ sub-issues → fail.
 * Each issue file is judged independently.
 */
export async function checkSubIssueAllowedPathsConflict(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    let subIssues
    try {
      subIssues = parseSubIssues(content)
    } catch {
      continue
    }

    if (subIssues.length === 0) continue

    // Count path → list of sub-issue ids that claim it
    const pathOwners = new Map()
    for (const sub of subIssues) {
      const subId = sub.id ?? '(unknown)'
      const paths = Array.isArray(sub.allowed_paths) ? sub.allowed_paths : []
      for (const p of paths) {
        if (!pathOwners.has(p)) pathOwners.set(p, [])
        pathOwners.get(p).push(subId)
      }
    }

    let fileFailed = false
    for (const [p, owners] of pathOwners) {
      if (owners.length > 1) {
        fileFailed = true
        results.push(fail(
          'sub_issue_allowed_paths_conflict',
          filePath,
          `allowed_paths conflict: "${p}" claimed by ${owners.length} sub-issues (${owners.join(', ')}).`,
          'Each file path must appear in at most one sub-issue allowed_paths within the same issue.'
        ))
      }
    }

    if (!fileFailed) {
      results.push(pass('sub_issue_allowed_paths_conflict', filePath, 'No allowed_paths conflicts across sub-issues.'))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C7 — depends_on
// ---------------------------------------------------------------------------

/**
 * C7: checkSubIssueDependsOn
 * depends_on must be an array (parseSubIssues throws on scalar, so this is
 * defensive for any edge case that slips through).
 * Each entry must match SUB_ISSUE_ID_PATTERN.
 * Self-reference (id in depends_on) → fail.
 */
export async function checkSubIssueDependsOn(root, issueDir, issueFiles) {
  const results = []

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    let subIssues
    try {
      subIssues = parseSubIssues(content)
    } catch {
      continue
    }

    if (subIssues.length === 0) continue

    let fileFailed = false

    for (const sub of subIssues) {
      const subId = sub.id ?? '(unknown)'
      const deps = sub.depends_on

      // Absent → fine, no dependency
      if (deps === undefined) continue

      // Defensive: scalar slipped through
      if (!Array.isArray(deps)) {
        fileFailed = true
        results.push(fail(
          'sub_issue_depends_on',
          filePath,
          `Sub-issue "${subId}" depends_on is not an array (got ${typeof deps}).`,
          'depends_on must be a YAML array, e.g. [POK-120-01] or a multi-line list.'
        ))
        continue
      }

      for (const dep of deps) {
        if (!SUB_ISSUE_ID_PATTERN.test(dep)) {
          fileFailed = true
          results.push(fail(
            'sub_issue_depends_on',
            filePath,
            `Sub-issue "${subId}" depends_on entry "${dep}" does not match pattern POK-NNN-NN.`,
            'Each depends_on entry must be a valid sub-issue id like POK-120-01.'
          ))
        }

        if (dep === subId) {
          fileFailed = true
          results.push(fail(
            'sub_issue_depends_on',
            filePath,
            `Sub-issue "${subId}" depends_on includes itself (self-reference).`,
            'Remove the self-reference from depends_on.'
          ))
        }
      }
    }

    if (!fileFailed) {
      results.push(pass('sub_issue_depends_on', filePath, 'All sub-issue depends_on entries are valid.'))
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// C8 — Decomposition required
// ---------------------------------------------------------------------------

/**
 * C8: checkSubIssueDecompositionRequired
 * Decomposition is mandatory when any objective trigger is met:
 * - AC count >= 5
 * - expected/actual changed_lines >= 300
 * - 2+ worker_type values are declared
 *
 * Required issues must either declare valid ## Worker Tasks YAML or opt out with:
 * worker_tasks: not_required
 * worker_tasks_skip_reason: "..."
 *
 * Legacy ## Sub-issues, sub_issues, and sub_issues_skip_reason remain accepted.
 */
export async function checkSubIssueDecompositionRequired(root, issueDir, issueFiles) {
  const results = []
  const activeIssue = await currentActiveIssue(root)
  const hasCurrentFile = activeIssue !== null

  for (const name of issueFiles) {
    const filePath = `${issueDir}/${name}`
    const content = await readOptional(root, filePath)
    if (content === null) continue

    const issueId = parentIdFromFile(name)

    let frontmatter
    let hasDeclaration
    try {
      frontmatter = parseFrontmatter(content)
      hasDeclaration = hasSubIssueDeclaration(frontmatter, content)
    } catch {
      continue // C1 already reports parse failures for malformed ## Sub-issues YAML
    }

    if (!shouldEnforceDecomposition(issueId, activeIssue, hasCurrentFile, frontmatter)) {
      results.push(pass('sub_issue_decomposition_required', filePath, 'Outside POK-142 enforcement scope.'))
      continue
    }

    const skipKey = skipDeclarationKey(frontmatter)
    const skipRequested = skipKey !== null
    const skipAllowed = hasSkipDeclaration(frontmatter)
    const reasons = decompositionReasons(frontmatter, content)

    if (skipRequested && !skipAllowed) {
      const reasonKey = skipKey === 'worker_tasks' ? 'worker_tasks_skip_reason' : 'sub_issues_skip_reason'
      results.push(fail(
        'sub_issue_decomposition_required',
        filePath,
        `${skipKey}: not_required is missing ${reasonKey}. Worker Tasks is preferred; Sub-issues is a legacy alias.`,
        `${decompositionDeclarationHint()} Legacy opt-out may use sub_issues_skip_reason.`
      ))
      continue
    }

    if (reasons.length === 0) {
      results.push(pass('sub_issue_decomposition_required', filePath, 'Decomposition not required.'))
      continue
    }

    if (hasDeclaration) {
      results.push(pass(
        'sub_issue_decomposition_required',
        filePath,
        `Decomposition required (${reasons.join('; ')}) and ${decompositionDeclarationLabel(content)} is declared. Worker Tasks is preferred; Sub-issues is legacy.`
      ))
      continue
    }

    if (skipAllowed) {
      results.push(pass(
        'sub_issue_decomposition_required',
        filePath,
        `Decomposition required (${reasons.join('; ')}) but explicitly skipped with ${skipKey === 'worker_tasks' ? 'worker_tasks_skip_reason' : 'sub_issues_skip_reason'}. Worker Tasks is preferred; Sub-issues is legacy.`
      ))
      continue
    }

    results.push(fail(
      'sub_issue_decomposition_required',
      filePath,
      `Decomposition required (${reasons.join('; ')}) but no Worker Tasks declaration or opt-out reason was found.`,
      decompositionDeclarationHint()
    ))
  }

  return results
}

// ---------------------------------------------------------------------------
// Integrated runner
// ---------------------------------------------------------------------------

/**
 * runSubIssueChecks(root, issueDir, issueFiles)
 * Runs all 8 checks and returns a flat results array.
 * Overall status is 'pass' only when every result is pass (uses every()).
 */
export async function runSubIssueChecks(root, issueDir, issueFiles) {
  const [
    c1, c2, c3, c4, c5, c6, c7, c8,
  ] = await Promise.all([
    checkSubIssueYamlParse(root, issueDir, issueFiles),
    checkSubIssueRequiredFields(root, issueDir, issueFiles),
    checkSubIssueIdFormat(root, issueDir, issueFiles),
    checkSubIssueWorkerType(root, issueDir, issueFiles),
    checkSubIssueAllowedPaths(root, issueDir, issueFiles),
    checkSubIssueAllowedPathsConflict(root, issueDir, issueFiles),
    checkSubIssueDependsOn(root, issueDir, issueFiles),
    checkSubIssueDecompositionRequired(root, issueDir, issueFiles),
  ])

  const all = [...c1, ...c2, ...c3, ...c4, ...c5, ...c6, ...c7, ...c8]
  const overallPass = all.every((r) => r.status === 'pass')

  return {
    status: overallPass ? 'pass' : (all.some((r) => r.status === 'fail') ? 'fail' : 'warning'),
    results: all,
  }
}
