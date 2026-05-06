type EnvConfig = Record<string, string | undefined>;

export function validateEnv(config: EnvConfig) {
  if (process.env.SKIP_DB_CONNECTION !== 'true' && !config.DB_URI) {
    throw new Error('DB_URI is required unless SKIP_DB_CONNECTION=true');
  }
  return config;
}
