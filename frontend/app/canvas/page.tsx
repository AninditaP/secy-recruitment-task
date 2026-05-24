'use client';

import { useState, useEffect } from 'react';
import { Tldraw } from 'tldraw';
import { useSyncDemo } from '@tldraw/sync';
import 'tldraw/tldraw.css';
import { UserMinus, Users, Hash } from 'lucide-react';

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

export default function CollaborativeCanvasPage() {
  const [roomName] = useState('sample room');
  const [mounted, setMounted] = useState(false);
  
 
  const store = useSyncDemo({ 
    roomId: roomName.toLowerCase().replace(/\s+/g, '-') 
  });

  const [members, setMembers] = useState([
    { id: 1, name: 'Anindita Padhi', role: 'Admin' },
    { id: 2, name: 'Peter Parker', role: 'Member' },
    { id: 3, name: 'Gwen Stacy', role: 'Member' },
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKick = (id: number) => {
    setMembers((currentMembers) => currentMembers.filter(member => member.id !== id));
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        
        
        <Sidebar className="border-r w-64 flex-shrink-0">
          
        
          <SidebarHeader className="border-b px-4 py-5">
            <div className="flex items-center gap-2">
    
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold text-base truncate w-40">{roomName}</span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 text-sm font-semibold mt-4">
                <Users className="w-4 h-4" />
                Room Members ({members.length})
              </SidebarGroupLabel>
              
              <SidebarGroupContent className="mt-2">
                <SidebarMenu>
                  {members.map((member) => (
                    <SidebarMenuItem 
                      key={member.id} 
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors mx-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{member.name}</span>
                        <span className="text-xs text-muted-foreground">{member.role}</span>
                      </div>
                      
                      {member.role !== 'Admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleKick(member.id)}
                          title={`Kick ${member.name}`}
                        >
                          <UserMinus className="h-4 w-4" />
                          <span className="sr-only">Kick</span>
                        </Button>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 relative z-0 flex items-center justify-center">
          {mounted ? (
            <Tldraw store={store} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">Loading canvas...</span>
            </div>
          )}
        </main>
        
      </div>
    </SidebarProvider>
  );
}