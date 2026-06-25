# Project Documentation

## CI/CD — Prebuild Workflow

### Automatic Triggers

The `Prebuild` workflow runs automatically on:

- **Push to `main`**
- **Pull requests** against any branch

### Manual Runs with Custom Coverage Thresholds

You can manually trigger a prebuild run with custom coverage thresholds using GitHub Actions `workflow_dispatch`.

#### How to run

1. Go to **Actions** → **Prebuild** in your GitHub repository.
2. Click **Run workflow**.
3. Select the branch you want to run on.
4. Fill in any threshold overrides (optional).
5. Click **Run workflow**.

#### Threshold inputs

| Input                           | Description                                                                    | Default                    |
| ------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| `coverage_threshold`            | Overrides **all four** metrics at once. Leave blank to use the branch default. | branch default (see below) |
| `coverage_threshold_statements` | Override statements threshold only                                             | inherits from base         |
| `coverage_threshold_branches`   | Override branches threshold only                                               | inherits from base         |
| `coverage_threshold_functions`  | Override functions threshold only                                              | inherits from base         |
| `coverage_threshold_lines`      | Override lines threshold only                                                  | inherits from base         |

#### Branch defaults

| Branch     | Default threshold |
| ---------- | ----------------- |
| `main`     | 80%               |
| `develop`  | 75%               |
| all others | 70%               |

When you provide a per-metric input (e.g. `coverage_threshold_lines`), it takes precedence over the base threshold for that metric only. The base threshold still applies to the other three metrics.

### Threshold presets: strict vs. relaxed

We recommend choosing a preset based on the purpose of the branch:

| Preset      | Suggested values                     | When to use                                                                                                                                                   |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strict**  | 80–90% across all metrics            | Release branches, `main`, or any branch where stability is critical. High coverage ensures regressions are caught before they reach production.               |
| **Relaxed** | 50–60% across all metrics            | Spike branches, experiments, prototypes, or early feature work where speed matters more than completeness. Prevents blocking while still catching major gaps. |
| **Default** | branch defaults from the table above | Normal feature development on `feature/*` or `develop`. Balanced gate that encourages good coverage without being punitive.                                   |

Use the **strict** preset when merging into `main` or cutting a release, because it enforces confidence in every code path. Use the **relaxed** preset only for short-lived branches where the goal is exploration, and expect to tighten thresholds before opening a PR to a stable branch.

#### How custom overrides interact with presets

The presets above are **guidelines**, not built-in workflow inputs. During a manual run you decide which preset to apply by entering the corresponding values into the `workflow_dispatch` form (or `gh` / `curl` flags).

**Interaction rules:**

1. **`coverage_threshold` sets the base for all metrics.** If you also supply per-metric inputs, those individual values override the base **only for that metric**.
2. **You can blend presets.** For example, start with a strict base (`coverage_threshold=80`) but relax just branches (`coverage_threshold_branches=70`) if your codebase has a lot of conditional logging that is hard to cover.
3. **Per-metric inputs are always optional.** Leave them blank to inherit from the base threshold. The base itself defaults to the branch default if you leave `coverage_threshold` blank.

**Practical example — strict base with one relaxed metric:**

```bash
gh workflow run prebuild.yml --ref feature/auth-refactor \
  -f coverage_threshold=80 \
  -f coverage_threshold_branches=65
```

This applies 80% to statements, functions, and lines, but lowers the branches gate to 65% for this run only.

**Practical example — strict base with multiple relaxed metrics:**

```bash
gh workflow run prebuild.yml --ref feature/legacy-migration \
  -f coverage_threshold=85 \
  -f coverage_threshold_branches=70 \
  -f coverage_threshold_functions=75
```

**Resulting effective thresholds:**

| Metric      | Effective threshold | Source                                    |
| ----------- | ------------------- | ----------------------------------------- |
| Statements  | 85%                 | inherits from strict base                 |
| Branches    | 70%                 | relaxed override (`coverage_threshold_branches`) |
| Functions   | 75%                 | relaxed override (`coverage_threshold_functions`) |
| Lines       | 85%                 | inherits from strict base                 |

This is useful when most of the codebase must meet a high bar, but specific metrics (e.g., branches in legacy code with complex conditionals, or functions in auto-generated wrappers) are temporarily harder to cover.

#### Example overrides

- **Tighten only branches coverage:** set `coverage_threshold_branches` to `90` and leave the others blank.
- **Run with completely custom thresholds:** set `coverage_threshold` plus any combination of per-metric inputs.
- **Strict gate (release branch):** keep overall at `80` but raise individual metrics:
  ```bash
  gh workflow run prebuild.yml --ref release/v1.0 \
    -f coverage_threshold=80 \
    -f coverage_threshold_statements=85 \
    -f coverage_threshold_branches=85 \
    -f coverage_threshold_functions=90
  ```
- **Relaxed gate (spike branch):** lower individual metrics while keeping lines at the default:
  ```bash
  gh workflow run prebuild.yml --ref spike/experiment \
    -f coverage_threshold=50 \
    -f coverage_threshold_statements=55 \
    -f coverage_threshold_branches=40 \
    -f coverage_threshold_functions=60
  ```

#### Triggering via GitHub API

You can also start a manual run using `curl` against the GitHub Actions REST API:

```bash
curl -X POST \
  -H "Authorization: token <GITHUB_TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo>/actions/workflows/prebuild.yml/dispatches \
  -d '{
    "ref": "feature/my-branch",
    "inputs": {
      "coverage_threshold": "75",
      "coverage_threshold_statements": "80",
      "coverage_threshold_branches": "70",
      "coverage_threshold_functions": "75"
    }
  }'
```

**Key parameters:**

- `ref`: the branch name to run on (required)
- `coverage_threshold`: overrides all metrics at once (optional)
- `coverage_threshold_statements` / `branches` / `functions` / `lines`: override individual metrics (optional)

#### Triggering with the GitHub CLI

If you have the [`gh` CLI](https://cli.github.com/) installed, you can dispatch from the terminal with explicit per-metric thresholds:

```bash
gh workflow run prebuild.yml \
  --ref feature/my-branch \
  -f coverage_threshold_statements=80 \
  -f coverage_threshold_branches=70 \
  -f coverage_threshold_functions=75
```

Each `-f` flag sets one input. You can also add `-f coverage_threshold=75` to override the base threshold for all metrics at once.

#### Direct dispatch URL

You can open the manual run form directly in the browser:

```
https://github.com/<owner>/<repo>/actions/workflows/prebuild.yml/dispatch?ref=feature/my-branch
```

> Note: GitHub’s UI does not support pre-filling workflow inputs via URL parameters. Use the **Run workflow** button on that page, or use the `curl` / `gh` examples above to pass thresholds automatically.

#### What happens after the run

- The job will **fail** if coverage falls below the active thresholds.
- A coverage summary is posted to the **GitHub PR** (or the workflow logs on manual runs).
- The full **HTML coverage report** is uploaded as a build artifact and kept for 30 days.
