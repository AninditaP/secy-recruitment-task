"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:8003"

function getToken() {
  return typeof window !== "undefined"
    ? localStorage.getItem("access_token")
    : null
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${AUTH_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}

export function WaitingRoom() {
  const router = useRouter()
  const [roomName, setRoomName] = useState("")
  const [joinRoomId, setJoinRoomId] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleCreateRoom = async () => {
    const token = getToken()
   
    if (!roomName.trim()) {
      setError("Room name cannot be empty")
      return
    }
    if (!token) {
      router.push("/Auth/login")
      return
    }
    setIsLoading(true)
    setError("")

    try {
      const res = await apiFetch("/rooms", { // Removed trailing slash just in case
        method: "POST",
        body: JSON.stringify({ name: roomName }),
      })
      
      // ALERTS only, no routing
      if (res && res.room_id) {
        alert(`Room created successfully!\n\nRoom ID: ${res.room_id}\n\nCopy this ID to join the room via the 'Join Room' tab.`)
      } else {
        throw new Error("No room ID returned from server")
      }

    } catch (err: any) {
      setError(err.message || "Failed to create room")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    const token = getToken()
    if (!joinRoomId.trim()) {
      setError("Room ID cannot be empty")
      return
    }
    if (!token) {
      router.push("/Auth/login")
      return
    }
    setIsLoading(true)
    setError("")

    try {
      await apiFetch(`/rooms/${joinRoomId}/join`, { method: "POST" })
      router.push(`/room/${joinRoomId}`)
    } catch (err: any) {
      setError(err.message || "Failed to join room")
    } finally {
      setIsLoading(false)
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
          {error && (
            <div className="mb-4 text-sm text-red-500 font-medium text-center">
              {error}
            </div>
          )}

          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Room</TabsTrigger>
              <TabsTrigger value="join">Join Room</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Room Name</Label>
                <Input
                  id="room-name"
                  placeholder="Enter a name for your room"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateRoom}
                disabled={isLoading || !roomName.trim()}
                className="w-full"
              >
                {isLoading ? "Creating..." : "Create Room"}
              </Button>
            </TabsContent>

            <TabsContent value="join" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-room-id">Room ID</Label>
                <Input
                  id="join-room-id"
                  placeholder="Paste the room ID here"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                />
              </div>
              <Button
                onClick={handleJoinRoom}
                disabled={isLoading || !joinRoomId.trim()}
                className="w-full"
              >
                {isLoading ? "Joining..." : "Join Room"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}