---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Ask the human what every issue here must carry (fields, labels, wording), unless it is
   already written down in this session or in the repo. The shape below is written down.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## What every issue carries

Approved by the human for plan morning-digest (2026-11-01); ask again only if a plan needs more.

- Label `plan:<plan name from plan.md frontmatter>`. The reviewer sorts by it.
- Body, in this order:

  ```md
  Source: plan.md § <n>

  **Scope**
  <what to change, files and rules that apply>

  **Done when**
  <the plan's "Done when", checkable>

  **Blocked by**
  <#n, or "none"; say when only "Done when" waits on another issue>
  ```

- An issue that waits on someone outside the repo (a reviewer, a host) stays open until they
  confirm. "Link sent" is not "reviewed": closing early blocks nothing and the clean-up runs too
  soon.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
