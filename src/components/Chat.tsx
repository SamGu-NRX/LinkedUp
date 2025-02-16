"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatProps {
  connectionId: string;
  senderId: string;
}

export default function Chat({ connectionId, senderId }: ChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // Fetch messages when the component mounts
  useEffect(() => {
    fetch(`/api/messages?connectionId=${connectionId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages));
  }, [connectionId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, senderId, content: newMessage }),
    });
    const data = await res.json();
    setMessages((prev) => [...prev, data.message]);
    setNewMessage("");
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex-1 overflow-y-auto p-4 border rounded">
        {messages.map((msg) => (
          <div key={msg.id} className={`p-2 my-1 ${msg.senderId === senderId ? "text-right" : "text-left"}`}>
            <p className="bg-gray-200 inline-block p-2 rounded">{msg.content}</p>
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  );
}
