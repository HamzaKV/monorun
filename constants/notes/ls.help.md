# monorun ls

List all workspace packages and optionally format or filter the output.

## Usage
```
monorun ls [--filter=package] [--output=json|yaml|xml|toml]
```


**Options:**
* `--filter` / `-f`: Filter which packages to list. Supports names and `[git]` diff filters.
* `--output` / `-o`: Specify the output format (json, yaml, xml, toml). Default is json.
