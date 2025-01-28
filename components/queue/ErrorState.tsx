import React from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <AlertCircle className="w-16 h-16 text-destructive mb-4" />
      <h2 className="text-2xl font-bold mb-2">Oops! Something went wrong</h2>
      <p className="text-muted-foreground mb-4">{message}</p>
      <Button onClick={onRetry}>Try Again</Button>
    </div>
  )
}

