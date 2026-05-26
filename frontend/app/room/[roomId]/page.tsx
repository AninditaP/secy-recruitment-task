'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CanvasBoard from '@/components/canvasboard';

interface RoomInfo {
  room_id: string;
  name: string;
  owner_id: string;
  is_active: boolean;
  capacity: number;
  member_count: number;
}

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8003';
const WS_URL   = process.env.NEXT_PUBLIC_WS_URL   || 'ws://localhost:8080';

function getToken() {
  return typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export default function RoomPage() {
  const params  = useParams();
  const router  = useRouter();
  const roomId  = params.roomId as string;

  const [roomInfo,      setRoomInfo]      = useState<RoomInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [wsUrl,         setWsUrl]         = useState('');
  const [controlUrl,    setControlUrl]    = useState('');
  const [error,         setError]         = useState('');
  const [ready,         setReady]         = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/Auth/login'); return; }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserId(payload.user_id);
    } catch {
      router.push('/Auth/login');
      return;
    }

    // canvas WS — Yjs sync
    setWsUrl(`${WS_URL}/ws/${roomId}?token=${token}`);

    // control WS — member list and room events
    setControlUrl(`${WS_URL}/control/${roomId}?token=${token}`);

    apiFetch(`/rooms/${roomId}`)
      .then((info: RoomInfo) => {
        if (!info.is_active) { setError('Room is no longer active'); return; }
        setRoomInfo(info);
        setReady(true);
      })
      .catch(() => setError('Room not found or you are not a member'));
  }, [roomId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!ready || !roomInfo || !wsUrl || !currentUserId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading canvas...</span>
        </div>
      </div>
    );
  }

  return (
    <CanvasBoard
      roomId={roomId}
      roomInfo={roomInfo}
      currentUserId={currentUserId}
      wsUrl={wsUrl}
      controlUrl={controlUrl}
      apiFetch={apiFetch}
    />
  );
}