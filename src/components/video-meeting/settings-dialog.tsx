import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Moon, Sun } from "lucide-react"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: "light" | "dark"
  onThemeChange: (theme: "light" | "dark") => void
}

export function SettingsDialog({ open, onOpenChange, theme, onThemeChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-200">Call Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-zinc-200">Video Quality</Label>
              <p className="text-xs text-zinc-400">Adjust video resolution</p>
            </div>
            <Select defaultValue="720p">
              <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="480p">480p</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-zinc-200">Noise Suppression</Label>
              <p className="text-xs text-zinc-400">Reduce background noise</p>
            </div>
            <Switch className="data-[state=checked]:bg-blue-500" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-zinc-200">Auto-gain Control</Label>
              <p className="text-xs text-zinc-400">Automatically adjust mic volume</p>
            </div>
            <Switch className="data-[state=checked]:bg-blue-500" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-zinc-200">Theme</Label>
              <p className="text-xs text-zinc-400">Choose light or dark mode</p>
            </div>
            <div className="flex items-center space-x-2">
              <Sun className={`w-4 h-4 ${theme === "light" ? "text-yellow-400" : "text-zinc-600"}`} />
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => onThemeChange(checked ? "dark" : "light")}
                className="data-[state=checked]:bg-blue-500"
              />
              <Moon className={`w-4 h-4 ${theme === "dark" ? "text-blue-400" : "text-zinc-600"}`} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

