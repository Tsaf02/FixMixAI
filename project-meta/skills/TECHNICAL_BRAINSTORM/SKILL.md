# TECHNICAL_BRAINSTORM

## Purpose
A Token-Efficient "Mixture of Experts" (MoE) protocol. The Coordinator creates a shared space for selected sub-agents to provide independent domain perspectives before making a decision.

---

## When to Use
- When the Coordinator or a Sub-Agent is stuck on a complex issue.
- **When the User explicitly requests it** (e.g., "Let's brainstorm UI/UX solutions", "Ask the team for ideas on this bug").

---

## Process

### Step 1 — Coordinator Setup
Coordinator creates a new file: `brainstorms/session-[N].md`.
It writes:
- **Problem Statement:** What is broken/undecided?
- **Context:** What was tried?
- **Prompt:** The specific question for the Sub-Agents.

**Smart Selection:** The Coordinator MUST NOT blindly ask all agents. Select ONLY the relevant agents. If an agent lacks the right skills for this specific problem, or if an agent is currently executing a long/critical task that shouldn't be interrupted, exclude them from the brainstorm.

The Coordinator updates the Dashboard, flagging ONLY the selected Sub-Agents to review the brainstorm file.

### Step 2 — Sub-Agent Contribution
Selected Sub-Agents read the brainstorm file and APPEND their perspective at the bottom.
Format:
```markdown
### [Sub-Agent Role] Perspective
- **Analysis:** [Brief technical analysis]
- **Proposed Solution:** [Actionable steps]
- **Risk:** [Potential downsides]
```

Sub-Agents do NOT delete or debate other agents' entries. They only append.
Once done, they mark their status as `✅ DONE` on the dashboard.

### Step 3 — Coordinator Synthesis
Once all requested Sub-Agents have contributed, the Coordinator reads the full brainstorm file.
The Coordinator synthesizes the opinions, identifies the safest/best path, and presents a plain-language summary and recommendation to the User in the main chat.

### Step 4 — Execution
If the user approves, the Coordinator creates standard Task files based on the winning approach.
