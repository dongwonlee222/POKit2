// POK-120 Sub-issue Schema — extracts worker task definitions from ## Worker Tasks
// (preferred) or ## Sub-issues (legacy alias) in an issue markdown file.
//
// POK-334: 단일 외부 YAML 의존성 제거 — node_modules 없는 fresh 트리/CI에서
// doctor·test가 ERR_MODULE_NOT_FOUND로 죽던 구멍을 닫는다. yaml-lite는 worker_tasks
// 코퍼스 전수(93블록)와 기존 파서 출력 동일성(93블록 전수)이 검증된 부분집합 파서다 (그 밖은 throw).

import { parseYamlLite } from './yaml-lite.mjs'

export const SUB_ISSUE_ID_PATTERN = /^POK-\d{3}-(?:\d{2}|W\d+)$/
export const REQUIRED_FIELDS = ['id', 'title', 'worker_type', 'allowed_paths', 'expected_output']

function extractSection(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const sectionRe = new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i')
  const sectionMatch = content.match(sectionRe)
  if (!sectionMatch) return null
  return sectionMatch[1]
}

// Extract the preferred worker decomposition section.
function extractWorkerTaskSection(content) {
  const workerTasks = extractSection(content, 'Worker Tasks')
  if (workerTasks !== null) return { heading: 'Worker Tasks', section: workerTasks }

  const subIssues = extractSection(content, 'Sub-issues')
  if (subIssues !== null) return { heading: 'Sub-issues', section: subIssues }

  return null
}

// Extract all ```yaml ... ``` fenced blocks from a section string.
function extractYamlBlocks(section) {
  const blocks = []
  const fenceRe = /```yaml\s*\n([\s\S]*?)```/g
  let match
  while ((match = fenceRe.exec(section)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

// Normalize a single parsed value: must be an object or array of objects.
// Returns an array of sub-issue objects.
function normalizeBlock(parsed, blockIndex, heading) {
  if (Array.isArray(parsed)) return parsed
  if (parsed !== null && typeof parsed === 'object') return [parsed]
  throw new TypeError(
    `${heading} yaml block[${blockIndex}]: expected a YAML mapping or sequence, got ${typeof parsed}`
  )
}

// Validate and normalize depends_on for a single sub-issue entry.
// Scalar → throw (per AC 2 spec: scalar forbidden).
function normalizeDependsOn(entry) {
  const v = entry.depends_on
  if (v === undefined) return entry

  if (Array.isArray(v)) return entry

  // scalar (string, number, boolean, null) → throw
  throw new TypeError(
    `Worker Task/Sub-issue "${entry.id ?? '?'}": depends_on must be a YAML array (got scalar: ${JSON.stringify(v)})`
  )
}

/**
 * parseSubIssues(content: string): SubIssue[]
 *
 * 1. Extract ## Worker Tasks, or legacy ## Sub-issues if Worker Tasks is absent.
 * 2. Find all ```yaml ... ``` fenced blocks within that section.
 * 3. yaml.load() each block and flatten into a single array.
 * 4. Return [] if section is absent or contains no yaml blocks.
 * 5. depends_on must be an array — scalar values throw a TypeError.
 */
export function parseSubIssues(content) {
  const extracted = extractWorkerTaskSection(content)
  if (!extracted) return []

  const blocks = extractYamlBlocks(extracted.section)
  if (blocks.length === 0) return []

  const results = []

  for (let i = 0; i < blocks.length; i++) {
    const parsed = parseYamlLite(blocks[i])
    if (parsed === null || parsed === undefined) continue

    const entries = normalizeBlock(parsed, i, extracted.heading)

    for (const entry of entries) {
      const normalized = normalizeDependsOn(entry)
      results.push(normalized)
    }
  }

  return results
}
