# AI Project Handoff

## 1. Project Goal

This repository is an AI job-hunting workbench for campus recruiting.

The current goal is not full productization.

The goal is to build the smallest demonstrable, resume-worthy system proving:

- Web-first product design
- PostgreSQL as the only business source of truth
- MCP / tool calling
- Agent-agnostic integration
- structured extraction
- entity matching
- state management
- human-in-loop
- evidence-based AI
- Skill / workflow design

Do not expand into a larger platform.

---

## 2. Architecture Boundary

Current target architecture:
External Agent
|
| MCP
|
v
Domain / Query / Service Layer
|
v
PostgreSQL
^
|
Web GUI


Rules:

- Web GUI remains the main human interface.
- PostgreSQL is the only business source of truth.
- MCP exposes business capabilities to external Agents.
- Agent does not maintain an independent application state.
- Web and MCP must reuse the same business rules.
- Candidate facts and recruitment status changes require human confirmation.
- Do not bind the product to one Agent framework.

---

## 3. Current Roadmap

Strict order:

### Phase 0 — Shared Application/Event domain rules

Status: DONE

Purpose:

Remove duplicated mutation logic between Web and Agent API.

Completed:

- shared application status mutation
- shared event append logic
- ownership validation
- appliedAt transition rule
- Event no longer implicitly changes application stage

Commit:
211be690ed03ae7197544a8f073a1df79005a362
refactor: share application and event domain rules


---

### Phase 1 — Read-only MCP

Status: DONE

Purpose:

Allow external Agents to safely read existing business data.

Completed:

- official MCP Streamable HTTP implementation
- ApiToken Bearer authentication
- user-scoped MCP context
- read-only tools

MCP tools:

list_applications
get_application
get_resume
get_today_application_events
get_upcoming_deadlines


Implementation:

- @modelcontextprotocol/server
- @modelcontextprotocol/client

Commit:

aaaf3240ba1081f7760e3b73d7736ad34586812f
feat: add read-only MCP tools


Important:

`get_resume` only exposes confirmed resume facts.

It uses:
loadConfirmedResumeDocument()


It never falls back to:

- raw parser output
- Resume.rawText
- unconfirmed resume data

---

### Phase 2 — Confirmed MCP Write + HITL

Status: DONE

Commit:

82c8eb8bd91d856b04cf3c875022ac86f7a0f5a5
feat: add confirmed MCP write flow


Goal:

Allow Agent-triggered writes while preventing unauthorized state mutation.

Implemented:

Agent
→ create proposal
→ user reviews in Web
→ user confirms
→ MCP executes
→ business state updates

---

## 4. Current Phase 2 Design

### AgentProposal

Proposal stores:

- owner/user
- applicationId
- proposal type
- exact payloadJson
- sourceType
- sourceIdentifier
- evidenceText
- status
- timestamps

State machine:
PENDING
|
v
CONFIRMED
|
v
EXECUTED

or:

PENDING
|
v
REJECTED

Migration:

prisma/migrations/20260925000010_add_agent_proposals/


---

## 5. Human-in-loop Rules

Important:

Agent cannot confirm proposals.

The following are NOT trusted:

- confirmed=true
- userApproved=true
- trustedAgent=true

Confirmation must happen through Web Session.

Current flow:
Agent API
|
v
PENDING proposal
|
v
/proposals Web page
|
v
User Confirm / Reject
|
v
CONFIRMED


Server validates:

- proposal ownership
- application ownership
- current user session
- proposal state

---

## 6. Current MCP Write Tools

Only two write tools exist:
update_application_status({ proposalId })

append_application_event({ proposalId })


Important:

MCP does not receive mutable business payload.

The server loads the confirmed proposal payload.

Both tools:

- are not read-only
- are destructive operations
- are marked non-idempotent

---

## 7. Write Safety

Implemented protections:

### Replay protection

Execution uses atomic state transition:

CONFIRMED
|
v
EXECUTED


Already executed proposals cannot execute again.

---

### Ownership isolation

Execution verifies:
proposal.userId
application.jobLead.ownerId
MCP token userId


Cross-user access is rejected.

---

### Domain service reuse

MCP handlers do NOT directly write Prisma.

They reuse:

updateApplicationStatus()
appendApplicationEvent()


Event append does not modify application stage.

---

## 8. Current Validation Status

Phase 2 tests passed:

Covered:

- unconfirmed proposal rejected
- confirmed proposal executes
- replay rejected
- cross-user rejected
- wrong application rejected
- payload integrity checked
- domain service reused
- event append does not change stage

Gates passed:

npx tsc --noEmit
npm run build
npm run release:static-check
git diff --check


---

## 9. Current Next Step

DO NOT start Phase 3 yet.

First complete Phase 2 E2E validation:

Required demo:
Agent API
|
v
Create PENDING proposal
|
v
Web /proposals
|
v
User Confirm
|
v
MCP write tool
|
v
Application/Event updated
|
v
Proposal EXECUTED
|
v
Replay rejected


Need to verify with:

- real Web Session
- real ApiToken
- local/dev PostgreSQL with migration applied

---

## 10. Future Roadmap

### Phase 3 — Recruitment email → Web write-back

Target:
Email
|
Agent extraction
|
Application matching
|
Proposal generation
|
Human confirmation
|
MCP write
|
Web timeline update


Requirements:

- preserve original email
- preserve extraction evidence
- uncertain matching cannot auto-update
- no direct Agent state mutation

---

### Phase 4 — JD + Resume Preparation Skill

Target:
JD
+
confirmed ResumeDocument
|
v
Evidence matching
|
v
Gap analysis
|
v
Interview preparation


Rules:

- no fabricated experience
- no fabricated numbers
- missing evidence must be marked as gap

---

## 11. Explicitly Out of Scope

Do not add unless explicitly requested:

- RAG
- pgvector
- knowledge graph
- multi-Agent
- planner
- Agent runtime
- workflow engine
- automatic job application
- browser automation
- automatic resume fact modification
- large dashboard
- independent vector database
- agentic RAG

---

## 12. Git Rules

Project path:
/home/rosbo/projects/job-hunt-ai-workbench


All technical commands run in WSL.

Every round:

1. Audit current state.
2. Make minimum changes.
3. Run gates.
4. Inspect diff.
5. Stage only related files.
6. Commit.
7. Do not push.

Never use:
git add .


Required:
npx tsc --noEmit
npm run build
npm run release:static-check
git diff --check


---

## 13. Existing Unrelated Dirty Files

These are user existing changes and must not be accidentally committed:

- app/actions.ts
- components/job-stage-progress.tsx
- lib/constants.ts
- lib/queries.ts
- prisma/schema.postgres.prisma
- prisma/schema.prisma
- prisma/migrations/20260921000009_add_written_test_application_stage/

Do not:

- reset
- stash
- overwrite
- include in unrelated commits

Always inspect:
git status
git diff


before committing.

---

## 14. Coding Agent Instructions

Coding Agent responsibilities:

- inspect current repository
- implement assigned task only
- run verification
- report result
- commit completed work

Coding Agent must not:

- redefine roadmap
- start next phase automatically
- introduce unrelated architecture changes

ChatGPT controls:

- roadmap
- scope
- architecture decisions
- phase transitions

---

## 15. Handoff Requirement

Before switching Coding Agent:

Report:

- current HEAD commit
- current phase
- completed work
- incomplete work
- exact next task
- modified files
- migrations
- gate results
- remaining dirty files

If incomplete:

- preserve working tree
- document exact breakpoint
- do not pretend completion
