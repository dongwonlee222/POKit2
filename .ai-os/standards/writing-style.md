# Writing Style Standard

## Purpose

Keep POKit public-first, token-conscious, and easy for Korean-speaking PO users to adopt.

## Language Policy

```yaml
language_policy:
  internal_contract: en
  file_names: en
  frontmatter_keys: en
  enum_values: en
  skill_instructions: en
  developer_notes: en
  user_facing_response: ko-KR
  user_facing_artifacts: ko-KR
  stakeholder_reports: ko-KR
  default_locale: ko-KR
```

## Rules

- Use English for machine-validated structure: file names, frontmatter keys, enum values, schema names, state names, skill contracts.
- Use Korean for PO-facing explanations, decisions, summaries, reports, and chat responses.
- Avoid company-internal names, local absolute paths, private SaaS assumptions, or personal workflow assumptions in public starter content.
- Write starter text so a new PO can copy it into a fresh project and understand the next action without prior context.
- Keep public templates short. Add details only when a gate or acceptance test needs them.

## Example

```markdown
---
id: POK-002
issue_type: spec
canonical_state: scoped
gate_state: pending
---

# POK-002 Public-first Starter 계약 확정

## Brief

공개형 PO가 빈 프로젝트에서 POKit을 바로 시작할 수 있게 starter 계약을 확정한다.
```
