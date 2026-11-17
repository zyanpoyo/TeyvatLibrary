---
name: handoff
description: >-
  Compact the current conversation into a handoff document for another agent to pick up. Use ONLY when the user asks to create a session handoff, switch agents/directories mid-task, or summarize the current thread for a fresh session. 別セッションや別エージェントへ作業を引き継ぐための引き継ぎドキュメントを作成する時に使用する。
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it outside the tracked workspace—either in the OS temporary directory (`$env:TEMP` / `%TEMP%` on Windows, `$TMPDIR` or `/tmp` on POSIX) or the conversation's `scratch/` directory—and report the exact file path.

Include a "suggested skills" section in the document, naming which skills from `<skills>` (and `.agents/skills/`) the next agent should read and follow.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, `.scratch/` tickets, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user specifies what the next session will focus on, tailor the handoff document accordingly.
