// Thin wrapper around fetch for the Django API. Uses the session cookie for
// auth and sends Django's CSRF token on every state-changing request.

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(errorMessage(data) ?? `Request failed (${status})`)
    this.status = status
    this.data = data
  }
}

function errorMessage(data: unknown): string | undefined {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.detail === 'string') return record.detail
    const first = Object.values(record)[0]
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
  }
  return undefined
}

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (UNSAFE_METHODS.has(method)) {
    const token = getCookie('csrftoken')
    if (token) headers.set('X-CSRFToken', token)
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    credentials: 'same-origin',
  })

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data as T
}

export const ensureCsrfCookie = () => api('/auth/csrf/')

/** Per-field messages from a DRF validation error, e.g. { email: 'Already exists.' }. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(error.data as Record<string, unknown>)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') result[field] = messages[0]
  }
  return result
}
