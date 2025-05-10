
type CrossImportOptions = {
    bun: string;
    node: string;
};

export const crossImport = async ({
    bun,
    node,
}: CrossImportOptions) => {
    // @ts-expect-error
    if (typeof Bun !== 'undefined') {
        return (await import(bun)).default;
    } else {
        return (await import(node)).default;
    }
};
