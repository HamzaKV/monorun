# monorun prune

Generate a production-ready output folder with pruned dependencies.

## Usage
```
monorun prune [--filter=package] [--out-dir=out] [--use-gitignore] [--docker]
```

**Options:**

* `--filter` / `-f`: Filter which packages to prune. Supports names and `[git]` diff filters.
* `--out-dir`: Target output directory (default: `out`).
* `--use-gitignore`: Exclude files matched by `.gitignore` or `.monorunignore`.
* `--docker`: Produces `json/` and `full/` subfolders for optimized Docker layering.
