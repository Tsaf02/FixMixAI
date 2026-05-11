# SHARED_WORKSPACE

## Purpose
Defines the "State & Details" protocol. The shared dashboard is the traffic light for the project, while dedicated files hold the heavy context. This minimizes token usage and maximizes precision.

---

## Core Rules

1. **The User Shield:** The user NEVER reads sub-agent logs. The Coordinator is the sole bridge. The Coordinator reads the dashboard, processes the technical details, and presents simple summaries/questions to the user.
2. **State vs. Details:** 
   - `PROJECT_DASHBOARD.md` contains ONLY the high-level state (Roster, Current Phase, Active Tasks Table).
   - Specific work happens in dedicated files (e.g., `tasks/task-01.md` or `brainstorms/session-02.md`).

---

## Coordinator Responsibilities
- Create task/brainstorm files with clear context.
- Update `PROJECT_DASHBOARD.md` to assign the file to a Sub-Agent.
- Monitor the Dashboard for status changes (`DONE`, `BLOCKED`, `NEEDS_REVIEW`).
- Read the relevant task file when a status changes, and summarize the outcome/blocker to the user in plain language.

---

## Dashboard Structure (`PROJECT_DASHBOARD.md`)
Keep it minimal to save tokens:

```markdown
# [Project Name]
Phase: [Current Phase]
Goal: [1-2 sentences on what we are building]

## Agent Roster
[List of active agents and their roles]

## Active Tracker
| Task ID / File | Owner | Status |
|---|---|---|
| `tasks/task-04.md` | Backend Agent | 🟡 IN PROGRESS |
| `tasks/task-05.md` | UI Agent | 🔴 BLOCKED |
```
