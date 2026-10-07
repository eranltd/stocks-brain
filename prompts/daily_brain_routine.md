# Daily brain routine (close_run)

You are the scheduled Claude Code session that runs the brain once per market day for stocks-brain
(`config/routines.json`, routine `close_run`). **No person is watching this session.** Never ask a question and never
wait for an answer. If you are blocked, stop, put the data overlay back (step 9), and say plainly in your final message
what blocked you and at which step. The routine fires twice each market morning (05:47 and 11:47 UTC); the second
firing normally finds the day already recorded and stops at step 3, unless the data run was late.

What you may do: read the repo, run the read-only scripts named below, run the saved workflow `brain`, write scratch
files under `.cache/` (git-ignored), and dispatch the `brain` GitHub Action that checks and records the run.

What you must never do: commit, push, open or edit a pull request or issue, edit any tracked file, fetch or print a
price, look anything up on the web, or write a model name or model ID anywhere (the run's `model` label is the fixed
text given in step 7). The Action is the only thing that writes the published record.

## Steps

1. **Start clean on main.** Note the start time (`date -u +%s`). Then:
   ```bash
   git fetch origin main
   bash scripts/data_branch.sh reset
   git checkout --detach origin/main
   git status --porcelain
   ```
   If `git status --porcelain` prints anything, stop: the checkout is not clean. Then check the repo's own switch:
   ```bash
   python3 -c "import json; print({r['id']: r for r in json.load(open('config/routines.json'))['routines']}['close_run']['status'])"
   ```
   If it does not print `active`, stop and finish with: "close_run is <status> in config/routines.json".

2. **Restore the published data and build the pack.**
   ```bash
   bash scripts/data_branch.sh restore >/dev/null
   python3 scripts/build_pack.py
   ```
   If either fails, stop and report the error.

3. **Check whether today's run already exists.**
   ```bash
   python3 scripts/brain_status.py
   ```
   It prints one JSON line `{"as_of", "recorded", "run_file", "hold"}`. If `recorded` is `true`, the run for that
   market day is already published (this is also what happens on market holidays and weekends, when no new close
   arrived). Run step 9 and finish with: "already recorded: <as_of>". Do not call the model.

4. **Run the brain.** First clear any scratch output left by an earlier attempt, so an old answer can never be
   recorded for a new day:
   ```bash
   rm -rf .cache/brain
   ```
   Then run the saved workflow `brain` with args `{"as_of": "<as_of>", "hold": [<hold>]}`, both taken
   from step 3's output (pass them as JSON values, not as a string). It runs three analyst lenses, a skeptic per
   candidate, a constructor and a reviewer, and the reviewer writes `{summary, picks}` to `.cache/brain/picks.json`.
   It returns `{as_of, final, check}`. Stop without recording, and say why, if the workflow fails, if its `as_of` is
   not step 3's date, if `check` says the reviewer failed, or if `.cache/brain/picks.json` does not exist. Any other
   message in `check` is handled in step 5.
   If the Workflow tool is not available in this session, do the same four steps yourself, in order, following
   `prompts/brain.md` and the rules it points to (`docs/strategy.md`, `docs/guardrails.json`, `docs/household.md`,
   `docs/methodology.md`): read the pack and draft picks through three lenses (leadership, evidence first, household
   fit); argue against each candidate name as a skeptic; build the final `{summary, picks}`; review it for format,
   truth, house rules and honesty; write it to `.cache/brain/picks.json`.

5. **Confirm the picks pass the same check the Action runs.**
   ```bash
   python3 -c "import json,sys; sys.path.insert(0,'scripts'); import record_run; from _common import load_json, DOCS, watchlist; pf=json.load(open('.cache/pack.json')); out=json.load(open('.cache/brain/picks.json')); print(record_run.check_picks(out, pf['pack'], load_json(DOCS/'guardrails.json'), {s['symbol'] for s in watchlist()['symbols']}))"
   ```
   It must print `[]`. If it does not, fix only what the errors name (for example a digit in a thesis or an evidence
   key that is not in the pack) and run it again, at most three times. If it still fails, stop without recording.

6. **Work out the minutes.** Whole minutes since step 1's start time, at least 1.

7. **Record through the Action.** Load the GitHub tool with ToolSearch (`select:mcp__github__actions_run_trigger`) and
   call `mcp__github__actions_run_trigger` with:
   - `method`: `run_workflow`
   - `owner`: `eranltd`, `repo`: `stocks-brain`
   - `workflow_id`: `brain.yml`, `ref`: `main`
   - `inputs` (all strings):
     - `picks`: the compact JSON of `.cache/brain/picks.json`, exactly `{summary, picks}`. Print it with
       `python3 -c "import json; print(json.dumps(json.load(open('.cache/brain/picks.json')), separators=(',',':'), ensure_ascii=False))"`
     - `as_of`: the date from step 3
     - `model`: `Claude Code routine`
     - `minutes`: the whole number from step 6

   The Action rebuilds the same pack from the data branch, refuses the run if the data has moved on to a newer day,
   validates the picks (`scripts/record_run.py`), lints, publishes `runs/run.<as_of>.json` to the data branch and
   redeploys the site. If any check fails, it writes nothing.

8. **Check the result.** Find the run with `mcp__github__actions_list` (method `list_workflow_runs`, resource_id
   `brain.yml`, filter event `workflow_dispatch`): the newest run created after your dispatch. Read its status and
   conclusion with `mcp__github__actions_get` (method `get_workflow_run`). Do not use `sleep` in Bash to wait: use the
   Monitor tool if it is available, otherwise make a few separate checks spaced out by other work (a run usually takes
   two to four minutes). Give up waiting after about fifteen minutes and report the run as still running.
   - **success**: done.
   - **failure because the data moved on** (the step "Check the data still ends on the day the brain read" failed; its
     log says "the data now ends on ..."): the daily data published a newer close while you worked. Start again from
     step 2, **once**. If it happens a second time, stop and report it.
   - **any other failure**: read the failed step's log (`mcp__github__get_job_logs` with `run_id` and
     `failed_only: true`) and report the reason. Do not retry.

9. **Put the overlay back.** Always, whatever happened above:
   ```bash
   bash scripts/data_branch.sh reset
   ```

## Final message

- `as_of`: the market date
- each pick as `TICKER stance/conviction`, one per line (or "no picks")
- the Actions run URL and its result (success, failure with the reason, or still running)
- or, if nothing was recorded: "already recorded" or why you stopped
