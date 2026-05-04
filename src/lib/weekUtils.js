// Returns the Monday of the current week as a Date
export function getCurrentWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Returns ISO date string (YYYY-MM-DD) for the Monday of the current week
export function getCurrentWeekStartStr() {
  return toDateStr(getCurrentWeekStart())
}

// Returns YYYY-MM-DD
export function toDateStr(date) {
  return date.toISOString().split('T')[0]
}

// Day index relative to week start (Mon=0 ... Sun=6)
export function getDayIndex() {
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

// Returns "Week X of 4" where X is based on the month's Mondays
export function getWeekOfMonth() {
  const monday = getCurrentWeekStart()
  const firstOfMonth = new Date(monday.getFullYear(), monday.getMonth(), 1)
  // find first Monday of the month
  const firstMonday = new Date(firstOfMonth)
  const fd = firstOfMonth.getDay()
  const offset = fd === 0 ? 1 : fd === 1 ? 0 : 8 - fd
  firstMonday.setDate(firstOfMonth.getDate() + offset)
  const weekNum = Math.floor((monday - firstMonday) / (7 * 86400000)) + 1
  return Math.max(1, Math.min(4, weekNum))
}

// Convert a timestamp to a day index (Mon=0…Sun=6) relative to weekStart
export function getDayIndexFromTimestamp(timestamp, weekStart) {
  const date = new Date(timestamp)
  const start = new Date(weekStart + 'T00:00:00')
  const diff = Math.floor((date - start) / (1000 * 60 * 60 * 24))
  return Math.max(0, Math.min(6, diff))
}

// Build 7-day status array
// Returns array of 'done' | 'excused' | 'rejected' | 'today' | 'missed' | 'future'
export function buildDayStates(checkinDays, weekStart, excusedDays = [], rejectedDays = []) {
  const weekStartDate = new Date(weekStart + 'T00:00:00')
  const states = []
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStartDate)
    dayDate.setDate(weekStartDate.getDate() + i)
    const isToday = dayDate.toDateString() === new Date().toDateString()
    const isFuture = dayDate > new Date() && !isToday
    if (checkinDays.includes(i)) states.push('done')
    else if (excusedDays.includes(i)) states.push('excused')
    else if (rejectedDays.includes(i)) states.push('rejected')
    else if (isToday) states.push('today')
    else if (isFuture) states.push('future')
    else states.push('missed')
  }
  return states
}

// Format date as "Monday, May 5"
export function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// Weeks since a date
export function weeksSince(dateStr) {
  if (!dateStr) return 0
  const then = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - then) / (7 * 86400000))
}
