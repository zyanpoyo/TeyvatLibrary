---
name: research
description: >-
  Investigate a question against high-trust primary sources and capture the findings as a cited Markdown file. Use when the user asks to research a topic deeply, verify official docs or API facts from primary sources, or delegate reading legwork to a background agent. 公式ドキュメントやソースコードなどの一次情報をもとに深く調査し、出典付き Markdown レポートを作成したい時に使用する。
---

Spin up a **background subagent** (via `invoke_subagent`) to do the research so you keep working while it reads. Start it with a fresh context window.

- For local codebase/file inspection only, use `research` (note that the built-in `research` subagent is read-only and has no network access).
- When external web/API primary sources (`search_web` / approved commands) or writing the output Markdown file directly are needed, use `self` (or perform web/file writes in the parent after the subagent reports).

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, or save under `.scratch/research/` (or `docs/` if permanent) and report the path.
