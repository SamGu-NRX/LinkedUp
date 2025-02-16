import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"

export const ScheduleCallForm: React.FC<{ onSchedule: () => void }> = ({ onSchedule }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined)

  const handleSchedule = () => {
    if (selectedDate && selectedTime) {
      console.log(`Scheduled call for ${selectedDate.toDateString()} at ${selectedTime}`)
      onSchedule()
    }
  }

  return (
    <div className="space-y-4">
      <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className="rounded-md border" />
      <Select onValueChange={setSelectedTime}>
        <SelectTrigger>
          <SelectValue placeholder="Select a time" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
            <SelectItem key={hour} value={`${hour}:00`}>
              {`${hour.toString().padStart(2, "0")}:00`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button onClick={handleSchedule} disabled={!selectedDate || !selectedTime}>
          Schedule Call
        </Button>
      </DialogFooter>
    </div>
  )
}

