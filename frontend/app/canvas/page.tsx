'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tldraw, useEditor } from 'tldraw';
import { useSync } from '@tldraw/sync';
import 'tldraw/tldraw.css';
import { UserMinus, Users, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';

interface Member {
  user_id: string;
  username: string;
}

interface RoomInfo {
  room_id: string;
  name: string;
  owner_id: string;
  owner_username: string;
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


function SaveButton() {
  const editor = useEditor();

  const handleSave = async () => {
    const shapeIds = [...editor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) {
      alert('Nothing to save — canvas is empty');
      return;
    }
    try {
      const snapshot = editor.getSnapshot();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-${Date.now()}.tldr`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
  };

  return (
    <button
      onClick={handleSave}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 500,
        padding: '8px 16px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      Save canvas
    </button>
  );
}


export default function CollaborativeCanvasPage() {
  const params   = useParams();
  const router   = useRouter();
  const roomId   = params.roomId as string;

  const [mounted,          setMounted]          = useState(false);
  const [roomInfo,         setRoomInfo]         = useState<RoomInfo | null>(null);
  const [members,          setMembers]          = useState<Member[]>([]);
  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null);
  const [wsUrl,            setWsUrl]            = useState<string>('');
  const [error,            setError]            = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);


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

    setWsUrl(`${WS_URL}/ws/${roomId}?token=${token}`);

    apiFetch(`/rooms/${roomId}`)
      .then((info: RoomInfo) => {
        if (!info.is_active) { setError('Room is no longer active'); return; }
        setRoomInfo(info);
        setMounted(true);
      })
      .catch(() => setError('Room not found or you are not a member'));
  }, [roomId]);

  const store = useSync({
    uri: wsUrl,
    assets: [] as any,
    assetUtils: [],
    bindingUtils: [],
    shapeUtils: [],
    migrations: [],
    records: {},
  });


  useEffect(() => {
    if (!mounted || !wsUrl) return;

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'user_joined':
            setMembers((prev) => {
              if (prev.find((m) => m.user_id === msg.user_id)) return prev;
              return [...prev, { user_id: msg.user_id, username: msg.username }];
            });
            break;
          case 'user_left':
            setMembers((prev) => prev.filter((m) => m.user_id !== msg.user_id));
            break;
          case 'kick':
            if (msg.user_id === currentUserId) {
              alert('You have been removed from the room');
              router.push('/dashboard');
            }
            break;
          case 'room_closing':
            alert(
              msg.reason === 'owner_absent'
                ? 'Owner left — room is closing.'
                : 'Owner closed the room.'
            );
            router.push('/dashboard');
            break;
        }
      } catch {
        console.error('Failed to parse WS message', event.data);
      }
    };

    ws.onerror = () => console.error('Control WS error');

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [mounted, wsUrl, currentUserId]);

  const handleKick = useCallback(async (targetUserId: string) => {
    try {
      await apiFetch(`/rooms/${roomId}/kick/${targetUserId}`, { method: 'DELETE' });
    } catch {
      alert('Failed to kick user');
    }
  }, [roomId]);

  const handleCloseRoom = useCallback(async () => {
    try {
      await apiFetch(`/rooms/${roomId}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch {
      alert('Failed to close room');
    }
  }, [roomId]);

  const isOwner = !!roomInfo && roomInfo.owner_id === currentUserId;

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }


  if (!mounted || !roomInfo) {
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
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">

        <Sidebar className="border-r w-64 flex-shrink-0">
          <SidebarHeader className="border-b px-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-base truncate">{roomInfo.name}</span>
              <span className="text-xs text-muted-foreground">
                {roomInfo.member_count} / {roomInfo.capacity} members
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent className="flex flex-col h-full">
            <SidebarGroup className="flex-1">
              <SidebarGroupLabel className="flex items-center gap-2 mt-4">
                <Users className="w-4 h-4" />
                Members ({members.length})
              </SidebarGroupLabel>

              <SidebarGroupContent className="mt-2">
                <SidebarMenu>
                  {members.length === 0 && (
                    <p className="text-xs text-muted-foreground px-4">
                      No one else here yet
                    </p>
                  )}
                  {members.map((member) => (
                    <SidebarMenuItem
                      key={member.user_id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 mx-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {member.username}
                          {member.user_id === currentUserId ? ' (you)' : ''}
                        </span>
                        {member.user_id === roomInfo.owner_id && (
                          <span className="text-xs text-muted-foreground">Owner</span>
                        )}
                      </div>
                      {isOwner && member.user_id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleKick(member.user_id)}
                          title={`Kick ${member.username}`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="px-4 pb-4 flex flex-col gap-2">
              {isOwner ? (
                showCloseConfirm ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      This closes the room for everyone.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="destructive" size="sm" className="flex-1" onClick={handleCloseRoom}>
                        Confirm
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCloseConfirm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => setShowCloseConfirm(true)}>
                    <X className="w-4 h-4 mr-2" /> Close room
                  </Button>
                )
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push('/dashboard')}>
                  <LogOut className="w-4 h-4 mr-2" /> Leave room
                </Button>
              )}
            </div>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 relative">
          <Tldraw store={store}>
            <SaveButton />
          </Tldraw>
        </main>

      </div>
    </SidebarProvider>
  );
}

