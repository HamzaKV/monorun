export const objectToXml = (obj: Record<string, string>): string => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<packages>\n';
    for (const [key, value] of Object.entries(obj)) {
        xml += `  <package>\n    <name>${key}</name>\n    <version>${value}</version>\n  </package>\n`;
    }
    xml += '</packages>';
    return xml;
};

export const objectToYaml = (obj: Record<string, string>): string => {
    let yaml = '';
    for (const [key, value] of Object.entries(obj)) {
        yaml += `${key}: ${value}\n`;
    }
    return yaml;
};

export const objectToToml = (obj: Record<string, string>): string => {
    let toml = '';
    for (const [key, value] of Object.entries(obj)) {
        toml += `[${key}]\nversion = "${value}"\n\n`;
    }
    return toml;
};
