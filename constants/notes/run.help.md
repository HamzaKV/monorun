# monorun run

Run scripts across your monorepo packages with task dependencies and filtering.

### Usage
```
monorun run <script or task> [flag]
```

**Options:**

* `--filter` / `-f`: Filter which packages to run on. Supports names and `[git]` diff filters.
* `--concurrency` / `-c`: Set max parallel processes (default is number of cores).
* `--watch` / `-w`: Watch mode, reruns tasks on file changes.
* `--dry-run` / `-d`: Simulate the execution without running scripts.
* `--skip-cache`: Disables writing to cache for the run.
* `--force`: Force run even if the run is already cached.
* `--package-manager` / `-p`: Use a specific package manager (npm, yarn, pnpm, bun).
