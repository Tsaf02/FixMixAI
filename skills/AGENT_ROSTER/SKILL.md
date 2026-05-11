# AGENT_ROSTER

## Purpose
The Coordinator uses this skill to research, select, and define the right Sub-Agents, models, and **work environments** for any project — based on current model strengths and project needs.

---

## When to Use
- Trigger phrases: "define team", "set up agents", "who should work on this", "agent roster", "build the team"
- At the start of any new project or major phase
- When a Sub-Agent is underperforming and a better model or tool may exist
- When a new technical domain is introduced mid-project

---

## Core Principle
**The Coordinator is always Gemini. Never a technical executor.**
The Coordinator does not write code, design architecture, or run tests.
The Coordinator selects who does, in which environment, and explains why to the user in plain language.

---

## Process

### Step 1 — Gather Project Context & Identify Gaps
Before selecting any Sub-Agent, the Coordinator must understand what is being built. 

1. **Scan Workspace:** First, read the project folder and existing documentation to gather available context.
2. **Identify the Core Goal:** Ensure the overarching goal of the project is clear.
3. **Determine Technical Stack & Constraints:** Based on the goal, the Coordinator should deduce the necessary technologies (e.g., React, Python).
4. **Ask the User for Missing Info:** Only if crucial information is missing, ask the user. Maintain flexibility based on the project's nature. Examples of things you *might* need to ask:
   - What is the current phase? (e.g., planning, MVP, bug fixing)
   - Are there specific constraints? (e.g., budget, local execution)
   - If the technical stack isn't obvious, ask for preferences, otherwise suggest the stack yourself.

---

### Step 2 — Determine Model Strengths
**Rely on your internal knowledge first. Search the web only when necessary.**

- For core coding and reasoning tasks, rely on your existing knowledge of leading models (e.g., Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro).
- Search the web **only** if:
  - The project involves a highly niche technical domain where you lack benchmark data.
  - The user explicitly asks about a newly released model.

---

### Step 3 — Define Roles, Environments, and Models
For each domain, define the role, the model, and the **Environment/Tool**.

```
ROLE: [name, e.g. "CTO", "UIAutomation Expert", "QA Lead"]
ASSIGNED MODEL: [model name]
ENVIRONMENT/TOOL: [e.g. "Claude Code in VS Code", "Gemini in Antigravity", "Cursor IDE"]
REASON: [1-2 sentences why this model and tool fit this role]
DOMAIN COVERAGE: [list of domains this Sub-Agent owns]
```

**Rules for role definition:**
- **Efficiency First:** Assign fast/light models (e.g., Gemini Flash, Claude Haiku) for simple tasks or data reading. Reserve heavy models (e.g., Claude Opus, GPT-4o) for complex logic and architecture.
- **Match the Tool to the Task:** If heavy refactoring is needed, suggest an environment like `Claude Code`. If deep architectural planning is needed, suggest `Gemini` in the current interface.
- Always combine at least 2 models in the team to leverage different strengths.
- The Coordinator is never assigned a technical role.

---

### Step 4 — Present Roster to User
Present the proposed team to the user in simple, plain language.

Format:
```
PROPOSED TEAM — [Project Name]

Coordinator: Gemini [version]
Role: Project Manager & Communication hub

[Role 1]: [Model] in [Environment/Tool]
Owns: [domains]
Why: [plain language reason]

[Role 2]: [Model] in [Environment/Tool]
Owns: [domains]
Why: [plain language reason]

[...]

Do you approve this team, or would you like to adjust any role or tool?
```

Wait for user approval before proceeding.

---

### Step 5 — Onboard Each Sub-Agent
After user approval:
1. Send the SUBAGENT_ONBOARDING skill to each Sub-Agent at session start.
2. Include their specific role and tool assignment from the approved roster.
3. Confirm they have read `PROJECT_DASHBOARD.md` before assigning any task.

---

### Step 6 — Document in Shared Workspace
After user approval, write the roster to `PROJECT_DASHBOARD.md` under:

```
## 👥 Agent Roster
[paste approved roster here]
Last updated: [date] by Coordinator
```

---

## Reassignment Rule
If at any point a Sub-Agent is blocked, producing poor results, or the domain shifts:
1. Coordinator re-evaluates the model or environment for the specific domain.
2. Proposes a replacement or addition (e.g., switching to a different model or suggesting a specialized VS Code extension).
3. Presents change to user with reasoning.
4. Updates dashboard after approval.
