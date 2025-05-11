import type { Config } from './types/config.type';

export function buildConfig<T extends Config>(config: T): T {
    return config;
};
