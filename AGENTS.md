# AGENTS.md

## Development conventions

- Keep each change small, focused, and within the currently requested milestone.
- Model domain state with explicit TypeScript types and immutable values where practical.
- Separate simulation state, behavior, and terminal presentation into distinct modules.
- Add or update focused Vitest coverage for every observable behavior change.
- Run `npm run typecheck` and `npm test` before handing work off.
- Prefer straightforward, readable code over premature abstractions. Document assumptions that shape future extension points.
- Do not add external services, agent frameworks, or UI layers unless the active milestone explicitly requires them.
