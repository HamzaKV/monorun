# @varlabs/monorun

**Monorun** is a fast, extensible monorepo task runner for JavaScript/TypeScript projects. Inspired by tools like Turborepo and Nx, it brings powerful filtering, dependency-aware task execution, caching, and Docker-optimized pruning — all while staying minimal and fast.

## 🚀 Features

- 🧠 **Dependency Graph Execution** – Tasks run in topological order based on workspace relationships.
- 🔍 **Advanced Filtering** – Use name filters, git-diff filters (`[main...]`, `[HEAD^1]`), and custom logic to scope execution.
- 📦 **Script Expansion** – Dependency-aware `dependsOn` for tasks (supports `^script`, `package#script`, and local `script` references).
- ⚙️ **Task Configuration** – Central `monorun.config.ts` for custom task definitions.
- 🪝 **Hooks & Caching** – Cache task results locally with SQLite. Remote hash support planned.
- 🐳 **Prune for Docker** – Output a production-ready pruned repo with optional `json/` + `full/` structure.
- 🧪 **Dry Run Support** – Visualize what would run without side effects.
- 🧩 **Custom Output Formats** – JSON, YAML, XML, TOML support for outputs like `ls`.
- 📁 **Smart Workspace Detection** – Detects workspace globs from your package manager config (npm, pnpm, yarn, bun).

## 📦 Usage

### Run a task/script:
```bash
monorun build
```

### Filter to specific packages:
```bash
monorun build --filter=apps/web
```

### Git diff filter:
```bash
monorun build --filter='[main...]'
```

### Combine filters:
```bash
monorun build --filter=apps/web --filter='[main...branch]'
```

### Dry run:
```bash
monorun build --dry-run
```

### List packages:
```bash
monorun ls --output json
```

### Graph dependencies:
```bash
monorun graph
```

### Prune for deployment:
```bash
monorun prune --docker
```

## 📦 Configuration (`monorun.config.ts` or `monorun.config.js`)

Monorun supports a configuration file named `monorun.config.ts` or `monorun.config.js` located at the root of your monorepo.

### Example (`monorun.config.ts`)

```ts
import { defineConfig } from '@varlabs/monorun';

export default defineConfig({
  tasks: {
    build: {
      dependsOn: ['^build', 'utils#test', 'lint'], // Run build on all dependencies first, test from utils package, and lint current package
    },
    test: {
      dependsOn: ['^build', 'lint'],
    },
    lint: {},
    'e2e': {
      dependsOn: ['build'],
    },
  },
});
```

### 🔧 Features

* **Task Definition**: Define reusable named tasks to orchestrate across packages.
* **Dependency Chaining**: Use `dependsOn` to specify task execution order.
* **Microsyntax** in `dependsOn`:

  * `^task`: Run task on all dependencies first.
  * `package#task`: Run task from another package.
  * `task`: Run task from the same package.

* **Custom Task Names**: Define custom task names for better organization.

## 🧪 Supported Flags

| Flag              | Description                                   |
|-------------------|-----------------------------------------------|
| `--filter`        | Filter packages by name or git diff syntax    |
| `--watch`         | Re-run tasks on file changes                  |
| `--concurrency`   | Limit concurrency for task execution          |
| `--output`        | Format output: `json`, `yaml`, `xml`, `toml`  |
| `--dry-run`       | Run without executing tasks                   |
| `--force`         | Force run all tasks, even if cached           |
| `--skip-cache`    | Skip writing to cache                         |
| `--docker`        | Enable Docker-optimized output in `prune`     |
| `--out-dir`       | Custom output directory for `prune`           |
| `--package-manager` | Override detected package manager           |
| `--help`          | Show help information                         |
| `--version`       | Show version information                      |

---

## 📁 Example Structure

```
monorepo/
├── packages/
│   ├── core/
│   └── utils/
├── apps/
│   └── web/
├── monorun.config.ts
├── package.json
└── .gitignore
```

## 📦 Install

npm:
```bash
npm install -g @varlabs/monorun
```

pnpm:
```bash
pnpm add -g @varlabs/monorun
```

yarn:
```bash
yarn global add @varlabs/monorun
```

bun:
```bash
bun add -g @varlabs/monorun
```

## Runtime Requirements
- Node.js 20 or higher
- Bun 1.2.0 or higher (if using Bun)

## 🛠️ Future Plans

- Support for watch mode
- GitHub Actions integrations
- Improved speed and performance
