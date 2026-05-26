'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

interface CanvasRoomProps {
  roomId: string;
  roomInfo: RoomInfo;
  currentUserId: string;
  wsUrl: string;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
}



function SaveButton() {
  const editor = useEditor();

  const handleSave = () => {
    const shapeIds = [...editor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) {
      alert('Nothing to save — canvas is empty');
      return;
    }
    try {
      const snapshot = editor.getSnapshot();
      const json     = JSON.stringify(snapshot, null, 2);
      const blob     = new Blob([json], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `canvas-${Date.now()}.tldr`;
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



export default function CanvasRoom({
  roomId,
  roomInfo,
  currentUserId,
  wsUrl,
  apiFetch,
}: CanvasRoomProps) {
  const router = useRouter();

  const [members,          setMembers]          = useState<Member[]>([]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // tldraw sync uses /ws/ endpoint only
  const store = useSync({ uri: wsUrl, assets: [] as any });

  // control socket uses /control/ endpoint — strip tldraw query params
  const controlUrl = wsUrl
    .replace('/ws/', '/control/')
    .split('&sessionId')[0];

  useEffect(() => {
    const ws = new WebSocket(controlUrl);

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
            setMembers((prev) =>
              prev.filter((m) => m.user_id !== msg.user_id)
            );
            break;

          case 'members_list':
            setMembers(msg.members.map((m: any) => ({
              user_id: m.user_id,
              username: m.username,
            })));
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
  }, [controlUrl, currentUserId]);


  const handleKick = useCallback(async (targetUserId: string) => {
    try {
      await apiFetch(`/rooms/${roomId}/kick/${targetUserId}`, { method: 'DELETE' });
    } catch {
      alert('Failed to kick user');
    }
  }, [roomId, apiFetch]);

  const handleCloseRoom = useCallback(async () => {
    try {
      await apiFetch(`/rooms/${roomId}`, { method: 'DELETE' });
      router.push('/dashboard');
    } catch {
      alert('Failed to close room');
    }
  }, [roomId, apiFetch]);

  const isOwner = roomInfo.owner_id === currentUserId;


  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">

        {/* ── Sidebar ── */}
        <Sidebar className="border-r w-64 flex-shrink-0">
          <SidebarHeader className="border-b px-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-base truncate">
                {roomInfo.name}
              </span>
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
                          <span className="text-xs text-muted-foreground">
                            Owner
                          </span>
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
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={handleCloseRoom}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setShowCloseConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCloseConfirm(true)}
                  >
                    <X className="w-4 h-4 mr-2" /> Close room
                  </Button>
                )
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
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