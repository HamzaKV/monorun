# monorun

## Usage
```
monorun <command> [options]
```

## Commands
- **run \<script\>** - Run a script across the monorepo
- **ls** - List all packages
- **graph** - Visualize dependency graph
- **prune** - Prepare monorepo for deployment

## Global Options
| Option | Description |
|--------|-------------|
| `-f, --filter` | Filter packages (by name or [git diff]) |
| `-c, --concurrency` | Max parallel task executions |
| `-w, --watch` | Watch mode |
| `-d, --dry-run` | Simulate run without executing |
| `--docker` | Enable Docker pruning behavior |
| `--skip-cache` | Skip caching layer |
| `--force` | Force run |
| `--out-dir` | Output directory (for prune) |
| `--output` | Output format (json, yaml, toml, xml) |
| `-p, --package-manager` | Manually specify package manager |
| `--help` | Show help |
| `--version` | Show version |

## Documentation
[https://npmjs.com/package/@varlabs/monorun](https://npmjs.com/package/@varlabs/monorun)
