// Shapes returned by the Django API.

export interface Announcement {
  id: number
  title: string
  body: string
  pinned: boolean
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type AlertLevel = 'info' | 'warning' | 'urgent'

export interface Alert {
  id: number
  message: string
  level: AlertLevel
  expires_at: string | null
  created_at: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high'

export interface Task {
  id: number
  title: string
  description: string
  assigned_to: number | null
  assigned_to_name: string | null
  department: number | null
  department_name: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  is_overdue: boolean
  created_at: string
  completed_at: string | null
}

export type EventType = 'production' | 'staff' | 'influencer' | 'other'

export interface CalendarEvent {
  id: number
  title: string
  description: string
  event_type: EventType
  start: string
  end: string
  all_day: boolean
  location: string
  department: number | null
  department_name: string | null
  attendees: number[]
  is_mine: boolean
}

export interface CrewGroup {
  department: string
  members: { id: number; first_name: string; last_name: string }[]
}

export interface StaffTaskSummary {
  counts: { todo: number; in_progress: number; overdue: number; done: number }
  open: Task[]
  open_total: number
}

export interface Dashboard {
  production: {
    name: string
    location_name: string
    time_zone: string
    today: string
    week_start: string
  }
  alerts: Alert[]
  announcements: Announcement[]
  daily_rundown: CalendarEvent[]
  my_tasks: Task[]
  staff_tasks: StaffTaskSummary | null
  week_events: CalendarEvent[]
  todays_crew: CrewGroup[]
}

export interface ForecastDay {
  date: string
  code: number
  description: string
  high: number
  low: number
  precipitation_chance: number | null
}

export type Weather =
  | { configured: false }
  | {
      configured: true
      location_name: string
      temperature_unit: string
      wind_unit: string
      current: {
        temperature: number
        feels_like: number
        humidity: number
        wind_speed: number
        code: number
        description: string
      }
      daily: ForecastDay[]
    }
