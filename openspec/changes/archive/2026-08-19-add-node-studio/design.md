# Design: add-node-studio

## Approach
Next.js app + `@xyflow/react`. Each node type maps to an Engine stage. Execution is HTTP (or local RPC) into NestJS: start run, resume, override artifact upload.

Graph JSON is the template: node ids, type, provider, mode, edges. Default template is the current linear pipeline plus optional Character/Compose branch.

Do not let users create arbitrary node types. Unknown types are rejected.

## Risks
- Desktop-first: no mobile canvas requirement.
- If Engine APIs are not ready, Studio can shell out to CLI as a temporary adapter — must be replaced before Dashboard QA depends on it.
