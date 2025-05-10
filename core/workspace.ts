import path from 'node:path';
import fs from 'node:fs/promises';
import { fileExists } from '../utils/file-exists';
import fg from 'fast-glob';
import type { Config } from '../types/config.type';
import micromatch from 'micromatch';
import yaml from 'js-yaml';

export type WorkspacePackage = {
    name: string;
    dir: string;
    packageJsonPath: string;
    dependencies: string[];
};

export type PackageManager = 'bun' | 'npm' | 'yarn' | 'pnpm';

export const isFile = async (filePath: string) => {
    try {
        const stats = await fs.stat(filePath);
        return stats.isFile();
    } catch {
        return false;
    }
};

export const isDirectory = async (dirPath: string) => {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    } catch {
        return false;
    }
};

export const detectPackageManager = async (workspaceRoot: string) => {
    if (await fileExists(path.join(workspaceRoot, 'bun.lockb'))) {
        return 'bun';
    } else if (await fileExists(path.join(workspaceRoot, 'package-lock.json'))) {
        return 'npm';
    } else if (await fileExists(path.join(workspaceRoot, 'yarn.lock'))) {
        return 'yarn';
    } else if (await fileExists(path.join(workspaceRoot, 'pnpm-lock.yaml'))) {
        return 'pnpm';
    } else {
        console.warn(`⚠️  No package manager lock file found in ${workspaceRoot}. Defaulting to npm.`);
        return 'npm';
    }
};

// get the workspace root directory
export const getWorkspaceRoot = async (startDir = process.cwd()) => {
    let currentDir = startDir;

    while (true) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (await isFile(packageJsonPath)) {
            return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            break; // Reached the root directory
        }
        currentDir = parentDir;
    }
    return null;
};

// load workspace config from root directory can be a js or ts file
export const loadWorkspaceConfig = async (workspaceRoot: string) => {
    const configPath = path.join(workspaceRoot, 'monorun.config.js');
    if (await isFile(configPath)) {
        const module = await import(`file://${configPath}`);
        return module.default as Config;
    }

    const tsConfigPath = path.join(workspaceRoot, 'monorun.config.ts');
    if (await isFile(tsConfigPath)) {
        const module = await import(`file://${tsConfigPath}`);
        return module.default as Config;
    }

    return null;
};

export const getWorkspaceGlobs = async (workspaceRoot: string) => {
    try {
        const packageManager = await detectPackageManager(workspaceRoot);
        switch (packageManager) {
            case 'pnpm': {
                const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
                if (await fileExists(pnpmWorkspacePath)) {
                    const contents = await fs.readFile(pnpmWorkspacePath, 'utf-8');
                    const config = yaml.load(contents) as any;
                    return Array.isArray(config?.packages) ? config.packages : [];
                }
                break;
            }
            case 'bun': {
                const pkgJsonPath = path.join(workspaceRoot, 'package.json');
                if (await fileExists(pkgJsonPath)) {
                    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
                    return Array.isArray(pkgJson?.workspaces) ? pkgJson.workspaces : [];
                }
                break;
            }
            case 'yarn':
            case 'npm': 
            default: {
                const pkgJsonPath = path.join(workspaceRoot, 'package.json');
                if (await fileExists(pkgJsonPath)) {
                    const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
                    const workspaces = pkgJson?.workspaces;
                    if (Array.isArray(workspaces)) return workspaces;
                    if (workspaces?.packages) return workspaces.packages;
                }
                break;
            }
        }
    } catch (error) {
        console.error(`Error loading workspace globs: ${error}`);
        return [];
    }
};

export const loadWorkspaces = async (workspaceRoot: string) => {
    const workspaceGlobs: string[] = await getWorkspaceGlobs(workspaceRoot);
    if (!Array.isArray(workspaceGlobs) || workspaceGlobs.length === 0) {
        throw new Error('No workspaces defined in root package.json.');
    }

    const packageDirs = await fg(workspaceGlobs, {
        cwd: workspaceRoot,
        onlyDirectories: true,
        absolute: true,
    });

    const results = new Map<string, WorkspacePackage>();

    for (const dir of packageDirs) {
        const packageJsonPath = path.join(dir, 'package.json');
        if (!(await isFile(packageJsonPath))) {
            continue; // Skip if package.json does not exist
        }
        const packageRaw = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageRaw);

        results.set(packageJson.name, {
            name: packageJson.name,
            dir,
            packageJsonPath: packageJsonPath,
            dependencies: Object.keys(packageJson.dependencies || {}),
        });
    }

    return results;
};

export const loadIgnorePatterns = async (workspaceRoot: string, useGitignore: boolean) => {
    let patterns: string[] = [];

    try {
        const baseIgnore = useGitignore
            ? await fs.readFile(path.join(workspaceRoot, '.gitignore'), 'utf8')
            : await fs.readFile(path.join(workspaceRoot, '.monorunignore'), 'utf8');

        patterns = baseIgnore
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch {
        // No ignore file found
    }

    patterns.push(
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        '**/.git/**',
    );

    return patterns;
};

export const shouldIgnore = (workspaceRoot: string, patterns: string[], filePath: string) => {
    const rel = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    return micromatch.isMatch(rel, patterns);
};

export const copyFiltered = async (workspaceRoot: string, src: string, dest: string, patterns: string[]) => {
    const stats = await fs.stat(src);

    if (shouldIgnore(workspaceRoot, patterns, src)) return;

    if (stats.isDirectory()) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            await copyFiltered(workspaceRoot, srcPath, destPath, patterns);
        }
    } else {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
    }
};
