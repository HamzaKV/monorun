import { type WorkspacePackage, type PackageManager, detectPackageManager } from './workspace.js';
import { Graph } from '@dagrejs/graphlib';
import type { Config, ConfigHooks } from '../types/config.type';
import { getRoots } from './graph.js';
import { buildDependencyGraph } from './graph.js';
import { generateHash, writeCache, readCache } from './cache.js';
import { runScript as spawn } from '../utils/run-script.js';
import { readFile } from 'node:fs/promises';

type RunOptions = {
    script: string;
    packages: Map<string, WorkspacePackage>;
    graph: Graph;
    options: {
        pkgManager: PackageManager; // Package manager to use
        concurrency?: number; // Optional concurrency limit
        dryRun?: boolean; // Optional dry run flag
        skipCache?: boolean; // Optional flag to skip cache read
        skipCacheWrite?: boolean; // Optional flag to skip cache write
        hooks?: ConfigHooks; // Optional hooks
    };
};

type RunTaskOptions = {
    taskName: string;
    task: Config['tasks'][string];
    root: string;
    options: Omit<RunOptions['options'], 'pkgManager'> & {
        pkgManager?: PackageManager; // Optional package manager override
    };
} & Omit<RunOptions, 'script'>;

export const runScript = async ({
    script,
    packages,
    graph,
    options: {
        pkgManager, // Package manager to use
        dryRun = false, // Optional dry run flag
        concurrency = Infinity, // Default concurrency to Infinity
        skipCache = false, // Optional flag to skip cache
        skipCacheWrite = false, // Optional flag to skip cache write
        hooks, // Optional hooks
    }
}: RunOptions) => {
    const degree: Record<string, number> = {};
    const running = new Set<string>();
    const completed = new Set<string>();
    const queue: string[] = [];

    // Initialize the degree of each node and find nodes with no dependencies
    for (const name of graph.nodes()) {
        const edges = graph.outEdges(name);
        degree[name] = edges ? edges.length : 0;
        if (degree[name] === 0) {
            queue.push(name);
        }
    }

    const runNext = async (): Promise<void> => {
        if (queue.length === 0 || running.size >= concurrency) return;

        const name = queue.shift();
        if (!name || running.has(name)) return;

        const pkg = packages.get(name);
        if (!pkg) return;

        const pkgJsonRaw = await readFile(pkg.packageJsonPath, 'utf-8');
        const pkgJson = JSON.parse(pkgJsonRaw);
        const command = pkgJson.scripts?.[script];

        if (!command) {
            console.log(`⚠️  [${name}] No '${script}' script. Skipping.`);
            completed.add(name);
            await schedule(name);
        } else {
            console.log(`\n▶️  [${name}] Running '${script}'...`);
            const hash = await generateHash(pkg, script);

            let cache;

            if (hooks?.cache?.read) {
                cache = hooks.cache.read(hash);
            } else {
                cache = readCache(hash);
            }

            if (!skipCache && cache && cache.status === 'success') {
                console.log(`⚠️  [${name}] '${script}' already executed. Skipping.`);
                completed.add(name);
                await schedule(name);
            } else {
                running.add(name);
                let exitCode = 0;
                if (!dryRun) {
                    exitCode = await spawn({
                        cmd: [pkgManager, 'run', script],
                        cwd: pkg.dir,
                    });
                }
                running.delete(name);

                if (exitCode !== 0) {
                    console.error(`❌ [${name}] '${script}' failed.`);
                    process.exit(exitCode);
                } else {
                    console.log(`✅ [${name}] '${script}' done.`);
                    if (!skipCacheWrite) {
                        if (hooks?.cache?.write) {
                            hooks.cache.write(hash, { pkg, script, status: 'success' });
                        } else {
                            writeCache(hash, pkg, script, 'success');
                        }
                    }
                    completed.add(name);
                    await schedule(name);
                }
            }
        }

        await runNext(); // Trigger more runs
    };

    const schedule = (name: string) => {
        const edges = graph.inEdges(name) || [];
        for (const edge of edges) {
            const source = edge.v;
            degree[source] -= 1;
            if (degree[source] === 0 && !completed.has(source)) {
                queue.push(source);
            }
        }
    }

    // Launch as many jobs as concurrency allows
    if (Number.isFinite(concurrency)) {
        const starters = Array.from({ length: concurrency }, runNext);
        await Promise.all(starters);
    } else {
        // Just run runNext on every initially available package
        await Promise.all(queue.map(runNext));
    }
};

export const runTask = async ({
    taskName,
    task,
    packages,
    graph,
    root,
    options: {
        pkgManager, // Package manager to use
        dryRun = false, // Optional dry run flag
        concurrency: taskConcurrency = Infinity, // Optional concurrency limit for the task
        skipCache = false, // Optional flag to skip cache
        skipCacheWrite = false, // Optional flag to skip cache write
    }
}: RunTaskOptions) => {
    const packageManager = pkgManager || task.packageManager || await detectPackageManager(root);

    // check if task has dependsOn property
    if (task.dependsOn && task.dependsOn.length > 0) {
        const tasksToRun = new Set<string>();
        const roots = getRoots(graph);
        // iterate over the dependsOn property and run the tasks in order
        for (const script of task.dependsOn) {
            // parse the script
            if (script.startsWith('^')) {
                const scpt = script.slice(1);
                for (const root of roots) {
                    if (!tasksToRun.has(`${root}...#${scpt}`)) {
                        tasksToRun.add(`${root}...#${scpt}`);
                    } else {
                        console.warn(`⚠️  [${root}] No '${scpt}' script. Skipping.`);
                    }
                }
            } else if (script.includes('#')) {
                // add the package name to the tasksToRun set
                if (!tasksToRun.has(script)) {
                    tasksToRun.add(script);
                }
            } else {
                for (const pkg of graph.nodes()) {
                    if (tasksToRun.has(`${pkg}#${script}`)) continue;
                    tasksToRun.add(`${pkg}#${script}`);
                }
            }
        }
        for (const root of roots) {
            if (!tasksToRun.has(`${root}#${taskName}`)) {
                tasksToRun.add(`${root}#${taskName}`);
            }
        }

        // run the tasks in order
        for (const taskToRun of tasksToRun) {
            const [pkg, script] = taskToRun.split('#');

            const baseGraph = buildDependencyGraph(packages, {
                root,
                filter: [pkg],
            });
            await runScript({
                script,
                packages,
                graph: baseGraph,
                options: {
                    pkgManager: packageManager,
                    dryRun,
                    concurrency: taskConcurrency,
                    skipCache: skipCache || task.cache?.skipRead,
                    skipCacheWrite: skipCacheWrite || task.cache?.skipWrite,
                },
            });
        }
    } else {
        // run the task directly
        await runScript({
            script: taskName,
            packages,
            graph,
            options: {
                pkgManager: packageManager,
                dryRun,
                concurrency: taskConcurrency,
                skipCache: skipCache || task.cache?.skipRead,
                skipCacheWrite: skipCacheWrite || task.cache?.skipWrite,
            },
        });
    }
};
