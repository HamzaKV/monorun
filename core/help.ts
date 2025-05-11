import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import type { Command } from 'types/strings.type';
import fs from 'node:fs/promises';

// @ts-expect-error
marked.use(markedTerminal());

export const help = async (command?: Command) => {
    const helpFile = `../constants/notes/${command || 'main'}.help.md`;
    const helpFilePath = new URL(helpFile, import.meta.url);

    try {
        const fileContent = await fs.readFile(helpFilePath, 'utf-8');
        const contents = await marked.parse(fileContent);
        console.log(contents);
    } catch (error) {
        console.error(`Error reading help file: ${error}`);
    }
};
