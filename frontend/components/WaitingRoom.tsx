"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, CheckCircle2 } from "lucide-react"

export function WaitingRoom() {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [joinRoomId, setJoinRoomId] = useState("")
  const [copied, setCopied] = useState(false)

  const generateRoomId = () => {
    const newRoomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    setRoomId(newRoomId)
  }

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleJoinRoom = () => {
    if (joinRoomId.trim()) {
      console.log("Joining room:", joinRoomId)
      // TODO: Implement join room logic
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Waiting Room</CardTitle>
          <CardDescription>Create a new room or join an existing one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Room</TabsTrigger>
              <TabsTrigger value="join">Join Room</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-id-display">Room ID</Label>
                {roomId ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                      {roomId}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyRoomId}
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Click "Create Room" to generate a room ID</p>
                )}
              </div>
              <Button onClick={generateRoomId} className="w-full">
                Create New Room
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-room-id">Room ID</Label>
                <Input
                  id="join-room-id"
                  placeholder="Enter room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleJoinRoom()
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleJoinRoom}
                disabled={!joinRoomId.trim()}
                className="w-full"
              >
                Join Room
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
