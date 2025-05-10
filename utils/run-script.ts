import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';

export type RunScriptArgs = {
    cmd: string[];
    cwd: string;
};

const execAsync = promisify(exec);

export const runScript = async ({
    cmd,
    cwd,
}: RunScriptArgs): Promise<number> => {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd[0], cmd.slice(1), {
            cwd,
            stdio: 'inherit',
        });

        proc.on('error', (err) => {
            console.error(`Error: ${err.message}`);
            reject(err);
        });

        proc.on('close', (code) => {
            resolve(code ?? 1); // Exit code or fallback to 1
        });
    });
};

export const runExec = async (cmd: string) => {
    try {
        const { stdout } = await execAsync(cmd);
        return stdout;
    } catch (error) {
        console.error(`Error executing command: ${error}`);
        return '';
    }
};
