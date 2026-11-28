[Claude] [KreiswertS] Publish the static demo on github.io
übernommen von mk-dev-4f am 2026-11-28 13:06
Rückmeldung an: mk-dev-ce
Kontext: Project ~/mk_dev/__project_kreiswertS (Next.js 16), branch
  main, commit 78ed1cf. The static demo is built, tested and
  reviewed; nothing is online yet.
  - `npm run demo:db && npm run demo:build` writes
    demo/out/web_kreiswerts/app/ (28 MB, 21 MB of it database files)
  - `npm run demo:serve` + `npm run demo:test`: 25 browser steps
    green · layout measured, 36 views without findings
  - security review (agent security-reviewer, 2026-11-28): nothing
    above low, "publish: yes" after two conditions, both done in
    78ed1cf
  - user decisions 2026-11-28: static version on github.io, demo
    logins only, registration off, notice = dialog on the first
    visit (Info:C), demo logins = list with one click (Login:A)
  - how everything works and its pitfalls: demo/README.md
Aufgabe: bring the demo online at
  https://lu4k87.github.io/web_kreiswerts/app/ and keep it there.
  1. Tooling first (~/mk_dev/ai_dev_workflow_global):
     bin/publish_pages.py build() empties the generated folders on
     every run (shutil.rmtree, about line 707) and writes 404.html
     from a map (about line 778) → a hand-copied web_kreiswerts/app/
     and a hand-edited 404.html are lost at the next publish from
     the Linux machine. Teach the generator: keep or publish an
     externally built sub-folder (config/projects.yaml, entry
     kreiswertS), a 404 rule that sends every path below
     /web_kreiswerts/app/ to /web_kreiswerts/app/?next=<path +
     query + hash> (demo/out/404.html holds the exact script,
     demo/boot.html reads ?next=), and a second button "Live-Demo"
     / "Live demo" on the project card. Tests:
     bin/test_publish_pages.py.
  2. Decide with the user where the built files live so the Linux
     machine can publish without building them (recommendation:
     committed only in the pages repository, the generator keeps
     the folder; alternative: build on every publish).
  3. Ask the user for approval. Then build from a clean, committed
     state (the notice shows commit and date of HEAD), copy
     demo/out/web_kreiswerts/app/ into the pages checkout and
     publish.
  4. Verify online on a fresh browser profile: start page with
     progress, notice dialog, login through the list, a deep link
     such as /web_kreiswerts/app/regional-map, the architecture
     page /web_kreiswerts/ still works. Run demo/test.mjs against
     the live address (it needs an override for ORIGIN).
  5. Architecture page: mention and link the live demo
     (scripts/architecture/build.py + de.json, then make.py), update
     the online copy; add the address to README.md "Static demo".
  6. Remove this note in the commit that finishes the task.
Dateien:
  - ~/mk_dev/ai_dev_workflow_global/bin/publish_pages.py
  - ~/mk_dev/ai_dev_workflow_global/bin/test_publish_pages.py
  - ~/mk_dev/ai_dev_workflow_global/config/projects.yaml
  - ~/mk_dev/lu4k87.github.io/web_kreiswerts/app/ (new), 404.html
  - demo/test.mjs (ORIGIN override), README.md
  - scripts/architecture/build.py, scripts/architecture/de.json,
    docs/architecture.html, docs/architecture.de.html
Beachten:
  - nothing goes online before the user approves in the new chat;
    an approval given in another chat does not count
  - check level 3: after the tooling change let the agent
    security-reviewer look at the diff (model fable, effort xhigh)
  - on this Mac the pre-push pages hook cannot publish and the full
    builder must not run (it would rebuild every project page from
    the Mac checkouts) → recipe in the project memory
    dev-team-page-always-current.md: pull the pages checkout,
    commit only the own paths, push
  - GitHub Pages (Jekyll) publishes no file or folder starting with
    "_" or "." → demo/build.mjs already stores them as "u_…"
  - open low findings of the review: theme and locale cookies use
    path=/ on the shared origin (theme-switch.tsx,
    language-switch.tsx, files of the frontend chats); taking the
    demo offline later needs an sw.js that unregisters itself
  - port 8085 on this Mac is held by a foreign preview server
    (PID 4564, its root is the scratchpad of an old chat) →
    treasury links answer 404; the user was asked, no answer yet
  - parallel chats work in the repository: commit only own paths
  - preview, layout and capture tools need the wrapper described
    in the machine memory layout-audit-on-this-mac
