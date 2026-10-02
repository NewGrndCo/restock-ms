export function secret(name: string): string | undefined {
  const runtime = (globalThis as { Netlify?: { env?: { get: (key: string) => string | undefined } } }).Netlify
  return runtime?.env?.get(name) || process.env[name]
}
