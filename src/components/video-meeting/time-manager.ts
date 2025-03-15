// New utility file to handle time management
export class TimeManager {
  private static readonly MAX_MINUTES = 20
  private static readonly TIME_INCREMENT = 5 * 60 // 5 minutes in seconds
  private static readonly REQUEST_COOLDOWN = 5 * 60 * 1000 // 5 minutes in milliseconds

  private lastRequestTime = 0

  constructor(private currentTime: number = 5 * 60) {} // Start with 5 minutes

  public canRequestTime(): boolean {
    const now = Date.now()
    return now - this.lastRequestTime >= TimeManager.REQUEST_COOLDOWN
  }

  public addTime(): boolean {
    // Convert current time to minutes
    const currentMinutes = Math.ceil(this.currentTime / 60)

    if (currentMinutes >= TimeManager.MAX_MINUTES) {
      return false
    }

    this.currentTime += TimeManager.TIME_INCREMENT
    this.lastRequestTime = Date.now()

    // Ensure we don't exceed max time
    if (this.currentTime > TimeManager.MAX_MINUTES * 60) {
      this.currentTime = TimeManager.MAX_MINUTES * 60
    }

    return true
  }

  public getRemainingTime(): number {
    return this.currentTime
  }

  public decrementTime(): void {
    if (this.currentTime > 0) {
      this.currentTime--
    }
  }

  public getTimeAddedMessage(): string {
    const currentMinutes = Math.ceil(this.currentTime / 60)
    return `Added 5 minutes (${currentMinutes} total)`
  }

  public static formatTime(seconds: number): string {
    const mins = Math.floor(Math.abs(seconds) / 60)
    const secs = Math.abs(seconds) % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
}

