// Shapes returned by the Django API.

export interface Department {
  id: number
  name: string
}

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

/** GET /production/ */
export interface ProductionSettings {
  name: string
  location_name: string
  latitude: number | null
  longitude: number | null
  time_zone: string
  units: string
  /** Today's date ("YYYY-MM-DD") where the production is. */
  today: string
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

export type TrackerType = 'airtag' | 'tile' | 'smarttag' | 'gps' | 'phone' | 'other'

export interface TrackerPing {
  latitude: string
  longitude: string
  accuracy_m: number | null
  note: string
  source: 'device' | 'manual'
  recorded_at: string
}

/** One tracked person on the CrewFinder (no device identifiers). */
export interface CrewFinderEntry {
  tracker_id: number
  tracker_type: TrackerType
  tracker_type_display: string
  label: string
  person: {
    id: number
    first_name: string
    last_name: string
    role_display: string
    department_name: string | null
    phone: string
    profile_picture: string | null
  }
  location: TrackerPing | null
}

/** Full tracker details, for Site Managers. */
export interface Tracker {
  id: number
  person: number
  person_name: string
  tracker_type: TrackerType
  tracker_type_display: string
  label: string
  identifier: string
  is_active: boolean
  created_at: string
  last_ping: TrackerPing | null
  /** Only right after creating a tracker. */
  token?: string
}

export type ResourceCategory =
  | 'catering'
  | 'equipment'
  | 'rentals'
  | 'transportation'
  | 'utilities'
  | 'technical'
  | 'stores'
  | 'permits'
  | 'medical'
  | 'lodging'
  | 'other'

/** In display order. Mirrors Resource.Category on the server. */
export const RESOURCE_CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: 'catering', label: 'Catering' },
  { value: 'equipment', label: 'Film equipment' },
  { value: 'rentals', label: 'Rentals' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'technical', label: 'Technical' },
  { value: 'stores', label: 'Stores' },
  { value: 'permits', label: 'Permits & film office' },
  { value: 'medical', label: 'Medical & safety' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'other', label: 'Other' },
]

export interface Resource {
  id: number
  company_name: string
  category: ResourceCategory
  category_display: string
  contact_name: string
  phone: string
  email: string
  website: string
  address: string
  notes: string
  updated_at: string
}

export type InfluencerPlatform = 'instagram' | 'tiktok' | 'youtube' | 'kick' | 'twitch' | 'other' | ''

export const INFLUENCER_PLATFORMS: { value: Exclude<InfluencerPlatform, ''>; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'kick', label: 'Kick' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'other', label: 'Other' },
]

/** Roster tile data. */
export interface InfluencerSummary {
  id: number
  name: string
  handle: string
  platform: InfluencerPlatform
  platform_display: string
  photo: string | null
  is_active: boolean
}

export interface InfluencerNote {
  id: number
  influencer: number
  body: string
  author_name: string | null
  created_at: string
  updated_at: string
}

export type TravelKind = 'flight' | 'ground' | 'hotel' | 'rail' | 'other'

export const TRAVEL_KINDS: { value: TravelKind; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'ground', label: 'Ground transport' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'rail', label: 'Train' },
  { value: 'other', label: 'Other' },
]

export interface TravelArrangement {
  id: number
  influencer: number
  kind: TravelKind
  kind_display: string
  provider: string
  reference: string
  confirmation: string
  depart_location: string
  arrive_location: string
  starts_at: string | null
  ends_at: string | null
  notes: string
}

/** Full profile. */
export interface Influencer extends InfluencerSummary {
  phone: string
  email: string
  address: string
  agent_name: string
  agent_phone: string
  agent_email: string
  travel_needs: string
  lodging_needs: string
  needs: string
  notes: InfluencerNote[]
  travel: TravelArrangement[]
  upcoming_events: { id: number; title: string; start: string; end: string; all_day: boolean; location: string }[]
}
