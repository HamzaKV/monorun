import fs from 'fs/promises';

export const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
};
