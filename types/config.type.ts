import type { WorkspacePackage, PackageManager } from '../core/workspace';
import type { CacheRow, ScriptStatus } from '../core/cache';

export type TaskContext = {
    pkg: WorkspacePackage; // The package being processed
    script: string; // The script to run
    status: ScriptStatus; // The status of the script execution
};

export type PackageNames = 'apps' | 'packages' | 'libs' | 'tools' | 'scripts' | 'docs' | 'e2e' | 'tests' | string & Record<never, never>; // Add more package names as needed

export type PackagePaths = {
    [name in PackageNames]: string; // Mapping of package names to their paths e.g. apps/**, packages/**, etc.
};

export type ConfigHooks = {
    cache?: {
        read: (hash: string) => CacheRow; // Function to read from the cache
        write: (hash: string, ctx: TaskContext) => void; // Function to write to the cache
    };
};

export type Config = {
    tasks: {
        [name: string]: {
            dependsOn?: string[]; // List of task names that this task depends on
            cache?: {
                skipRead?: boolean; // Whether to skip reading from the cache
                skipWrite?: boolean; // Whether to skip writing to the cache
            };
            packageManager?: PackageManager; // override the package manager for this task
        };
    };
    hooks?: ConfigHooks;
};
