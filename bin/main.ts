#!/usr/bin/env node

import { 
    getWorkspaceRoot, 
    loadWorkspaces, 
    loadWorkspaceConfig, 
    detectPackageManager, 
    loadIgnorePatterns, 
    copyFiltered, 
    isFile, 
    shouldIgnore,
    isDirectory,
} from '../core/workspace';
import type { PackageManager } from '../core/workspace';
import { buildDependencyGraph, toDotFormat } from '../core/graph';
import { runScript, runTask } from '../core/runner';
import { parseArgs } from 'node:util';
import type { Command } from '../types/strings.type';
import { commands } from '../constants/strings';
import type { FilterMode } from '../core/resolve-filter';
import path from 'node:path';
import { cp, readdir, rmdir, readFile, mkdir } from 'fs/promises';
import { objectToXml, objectToToml, objectToYaml } from '../utils/formats';

const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
        concurrency: {
            type: 'string',
            short: 'c',
        },
        watch: {
            type: 'boolean',
            short: 'w',
            default: false,
        },
        filter: {
            type: 'string',
            short: 'f',
            multiple: true,
        },
        'filter-mode': {
            type: 'string',
            short: 'm',
            default: 'or',
        },
        'skip-cache': {
            type: 'boolean',
        },
        force: {
            type: 'boolean',
            short: 'F',
            default: false,
        },
        'package-manager': {
            type: 'string',
            short: 'p',
        },
        'dry-run': {
            type: 'boolean',
            short: 'd',
            default: false,
        },
        docker: {
            type: 'boolean',
            default: false,
        },
        'out-dir': {
            type: 'string',
        },
        'use-gitignore': {
            type: 'boolean',
            default: false,
        },
        output: {
            type: 'string',
            short: 'o',
        },
    },
    strict: true,
    allowPositionals: true,
});

let command: Command | undefined = undefined;
if (positionals[0] && commands.includes(positionals[0] as Command)) {
    command = positionals[0] as Command;
}

const root = await getWorkspaceRoot();
if (!root) {
    console.error('No workspace root found.');
    process.exit(1);
}

const packages = await loadWorkspaces(root);
const graph = buildDependencyGraph(packages, {
    filter: values.filter,
    filterMode: values['filter-mode'] as FilterMode | undefined,
    root,
});

const config = await loadWorkspaceConfig(root);

if (!config) {
    console.error('No workspace config found.');
    process.exit(1);
}

if (command === 'ls') {
    const output = values.output;
    console.log('Listing all packages...');
    const packageNames = graph.nodes();

    let outputObject: Record<string, string> = {};
    for (const pkg of packageNames) {
        const packageDetails = packages.get(pkg);
        const packageContent = packageDetails ? await readFile(packageDetails.packageJsonPath) : 'Unknown package';
        const packageJson = JSON.parse(packageContent.toString());
        const packageVersion = packageJson.version;

        if (output) {
            outputObject[pkg] = packageVersion || 'Unknown version';
        } else {
            if (packageVersion) {
                console.log(`- ${pkg}: @${packageJson.version}`);
            } else {
                console.log(`- ${pkg}: Unknown version`);
            }
        }
    }

    if (output) {
        switch (output) {
            case 'json':
                console.log(JSON.stringify(outputObject, null, 2));
                break;
            case 'yaml':
                const yamlOutput = objectToYaml(outputObject);
                console.log(yamlOutput);
                break;
            case 'toml':
                const tomlOutput = objectToToml(outputObject);
                console.log(tomlOutput);
                break;
            case 'xml':
                const xmlOutput = objectToXml(outputObject);
                console.log(xmlOutput);
                break;
            case 'csv':
                const csvHeader = 'package,version';
                const csvRows = Object.entries(outputObject)
                    .map(([pkg, version]) => `${pkg},${version}`)
                    .join('\n');
                console.log(`${csvHeader}\n${csvRows}`);
                break;
            default:
                console.error(`Unknown output format: ${output}`);
                process.exit(1);
        }
    }

    console.log(`Total packages: ${packageNames.length}`);
    process.exit(0);
}

if (command === 'graph') {
    console.log('Generating dependency graph...');
    const dot = toDotFormat(graph);
    console.log(dot);
    process.exit(0);
}

if (command === 'prune') {
    const outDirName = values['out-dir'] || 'out';
    const useDocker = values['docker'];
    const useGitignore = values['use-gitignore'];
    let outDir = path.join(root, outDirName);
    const outJsonDir = path.join(outDir, 'json');

    // delete the out directory if it exists
    if (await isDirectory(outDir)) {
        await rmdir(outDir, { recursive: true });
    }

    if (useDocker) {
        await mkdir(outJsonDir, { recursive: true });
        outDir = path.join(outDir, 'full');
    }

    await mkdir(outDir, { recursive: true });

    const ignorePatterns = await loadIgnorePatterns(root, useGitignore);

    console.log(`Pruning packages to ${outDir}...`);
    // copy the files in the root directory to the out directory
    const rootFiles = await readdir(root);
    for (const file of rootFiles) {
        const filePath = path.join(root, file);
        const outFilePath = path.join(outDir, file);
        if (await isFile(filePath) && !shouldIgnore(root, ignorePatterns, filePath)) {
            if (useDocker && file.includes('package.json')) {
                const outJsonFilePath = path.join(outJsonDir, file);
                await cp(filePath, outJsonFilePath, { recursive: true });
            }
            await cp(filePath, outFilePath, { recursive: true });
        }
    }

    // copy the files of the packages to a new directory called 'out
    for (const pkg of graph.nodes()) {
        const packageDetails = packages.get(pkg);
        if (!packageDetails) {
            console.error(`Package ${pkg} not found.`);
            continue;
        }
        const relativePath = path.relative(root, packageDetails.dir);
        if (useDocker) {
            // stripe out the root directory from the packageJsonPath
            const outJsonFileDir = path.join(outJsonDir, relativePath);
            await mkdir(outJsonFileDir, { recursive: true });
            const outJsonFilePath = path.join(outJsonFileDir, 'package.json');
            await cp(packageDetails.packageJsonPath, outJsonFilePath, { recursive: true });
        }
        const outPackageDir = path.join(outDir, relativePath);
        await copyFiltered(root, packageDetails.dir, outPackageDir, ignorePatterns);
    }
    console.log(`Pruned packages to ${outDir}.`);
    process.exit(0);
}

const script = positionals[command ? 1 : 0] || 'build';
const concurrency = values.concurrency ? parseInt(values.concurrency) : undefined;

console.log(`Running script '${script}' in order...`);
console.time(`Script '${script}'`);
const task = config.tasks[script];
const dryRun = values['dry-run'];
if (task) {
    await runTask({
        taskName: script,
        task,
        packages,
        graph,
        root,
        options: {
            pkgManager: values['package-manager'] as PackageManager,
            dryRun,
            concurrency,
            skipCache: values.force,
            skipCacheWrite: values['skip-cache'],
            hooks: config.hooks,
        }
    });
} else {
    await runScript({
        script,
        packages,
        graph,
        options: {
            pkgManager: (values['package-manager'] || (await detectPackageManager(root))) as PackageManager,
            dryRun,
            concurrency,
            skipCache: values.force,
            skipCacheWrite: values['skip-cache'],
            hooks: config.hooks,
        },
    });
}
console.timeEnd(`Script '${script}'`);
console.log(`All scripts completed successfully.`);
