import postgres from 'postgres'

declare global {
  // eslint-disable-next-line no-var
  var __abiSql: ReturnType<typeof postgres> | undefined
}

export function getSql() {
  const url = process.env.ABI_DATABASE_URL
  if (!url) return null
  if (!globalThis.__abiSql) {
    globalThis.__abiSql = postgres(url, { max: 5, idle_timeout: 30 })
  }
  return globalThis.__abiSql
}
