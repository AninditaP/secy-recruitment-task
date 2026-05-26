const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8003'
const WS_URL   = process.env.NEXT_PUBLIC_WS_URL   || 'ws://localhost:8080'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {

  // ── Auth ───────────────────────────────────────────────────────
  login: (username: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    return fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Login failed')
      }
      return res.json()
    })
  },

  register: (username: string, password: string) =>
    fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Registration failed')
      }
      return res.json()
    }),

  getMe: () => apiFetch('/me'),

  // ── Rooms ──────────────────────────────────────────────────────
  createRoom: (name: string) =>
    apiFetch('/rooms/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  joinRoom: (roomId: string) =>
    apiFetch(`/rooms/${roomId}/join`, { method: 'POST' }),

  getRoomInfo: (roomId: string) =>
    apiFetch(`/rooms/${roomId}`),

  getRoomMembers: (roomId: string) =>
    apiFetch(`/rooms/${roomId}/members`),

  kickUser: (roomId: string, targetUserId: string) =>
    apiFetch(`/rooms/${roomId}/kick/${targetUserId}`, { method: 'DELETE' }),

  closeRoom: (roomId: string) =>
    apiFetch(`/rooms/${roomId}`, { method: 'DELETE' }),

  // ── WebSocket ──────────────────────────────────────────────────
  getWsUrl: (roomId: string): string => {
    const token = getToken()
    return `${WS_URL}/ws/${roomId}?token=${token}`
  },
}