// Shapes returned by the Django API.

import type { Role } from './auth/roles'

export interface Department {
  id: number
  name: string
  /** Active people in the department. */
  member_count?: number
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
  created_by_name: string | null
  created_at: string
  completed_at: string | null
}

export type EventType = 'production' | 'staff' | 'influencer' | 'support' | 'other'

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
  /** Shared by the events scheduled together as one block; null for one-offs. */
  block: string | null
  is_mine: boolean
}

/** A phase or milestone on the Master Timeline. Dates are "YYYY-MM-DD"; a
 * milestone starts and ends on the same day. */
export interface TimelineItem {
  id: number
  name: string
  start_date: string
  end_date: string
  description: string
  created_by_name: string | null
  updated_at: string
}

export type DocumentCategory =
  | 'insurance'
  | 'permit'
  | 'contract'
  | 'vehicle'
  | 'invoice'
  | 'voucher'
  | 'receipt'
  | 'other'

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'permit', label: 'Permits' },
  { value: 'contract', label: 'Contracts' },
  { value: 'vehicle', label: 'Vehicle documents' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'voucher', label: 'Vouchers' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'other', label: 'Miscellaneous' },
]

/** Where a receipt is in reimbursement, in order. */
export type ReceiptStatus = 'submitted' | 'viewed' | 'in_process' | 'processed'

export const RECEIPT_STATUSES: { value: ReceiptStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'in_process', label: 'In process' },
  { value: 'processed', label: 'Processed' },
]

export interface ProjectDocument {
  id: number
  title: string
  category: DocumentCategory
  category_display: string
  file_name: string
  file_size: number | null
  notes: string
  expires_on: string | null
  vendor: string
  amount: string | null
  purchase_date: string | null
  status: ReceiptStatus
  status_display: string
  status_changed_at: string | null
  uploaded_by_name: string | null
  is_mine: boolean
  created_at: string
  updated_at: string
}

export type LocationKind = 'lodging' | 'airport' | 'shooting' | 'production' | 'other'

/** In the order the Locations page lists them. */
export const LOCATION_KINDS: { value: LocationKind; label: string; plural: string }[] = [
  { value: 'lodging', label: 'Lodging', plural: 'Lodging' },
  { value: 'airport', label: 'Airport', plural: 'Airports' },
  { value: 'shooting', label: 'Shooting location', plural: 'Shooting locations' },
  { value: 'production', label: 'Production base', plural: 'Production base' },
  { value: 'other', label: 'Other', plural: 'Other places' },
]

export interface ProductionLocation {
  id: number
  name: string
  kind: LocationKind
  custom_type: string
  type_label: string
  address: string
  latitude: string | null
  longitude: string | null
  phone: string
  website: string
  contact_name: string
  notes: string
  updated_at: string
}

// Finance. Money arrives from the API as decimal strings ("1250.00").

export type PaymentMethodKind = 'card' | 'bank' | 'digital'

export interface PaymentMethod {
  id: number
  name: string
  kind: PaymentMethodKind
  kind_display: string
  /** Name plus "ending 1234". */
  label: string
  institution: string
  last4: string
  holder: string
  notes: string
  is_active: boolean
  /** Records that point at this method. */
  uses: number
}

export type InvoiceStatus = 'unpaid' | 'scheduled' | 'paid'

export interface Invoice {
  id: number
  vendor: string
  number: string
  description: string
  amount: string
  issued_on: string | null
  due_on: string | null
  status: InvoiceStatus
  status_display: string
  is_overdue: boolean
  paid_on: string | null
  payment_method: number | null
  payment_method_label: string | null
  document_id: number | null
  file_name: string | null
  archived: boolean
  created_at: string
}

export type DraftFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface AutoDraft {
  id: number
  payee: string
  description: string
  amount: string
  frequency: DraftFrequency
  frequency_display: string
  next_on: string
  payment_method: number | null
  payment_method_label: string | null
  is_active: boolean
}

export type OutgoingKind = 'vendor' | 'payroll' | 'draft' | 'other'

export interface OutgoingPayment {
  id: number
  paid_on: string
  payee: string
  amount: string
  kind: OutgoingKind
  kind_display: string
  description: string
  reference: string
  payment_method: number | null
  payment_method_label: string | null
  invoice: number | null
  invoice_label: string | null
  paycheck: number | null
  paycheck_person: number | null
  auto_draft: number | null
}

export interface Deposit {
  id: number
  received_on: string
  source: string
  amount: string
  description: string
  deposited_into: number | null
  deposited_into_label: string | null
  document_id: number | null
  file_name: string | null
}

export type PayUnit = 'day' | 'hour' | 'week'

export interface PayRate {
  unit: PayUnit
  unit_display: string
  rate: string
  notes: string
}

export interface ReceiptSummary {
  id: number
  title: string
  vendor: string
  amount: string | null
  purchase_date: string | null
  status: ReceiptStatus
  status_display: string
  paycheck: number | null
  created_at: string
}

export interface Paycheck {
  id: number
  person: number
  person_name: string
  period_start: string
  period_end: string
  pay_date: string
  unit: PayUnit
  unit_display: string
  quantity: string
  rate: string
  adjustment: string
  receipts: number[]
  receipt_details: ReceiptSummary[]
  wages: string
  reimbursements: string
  total: string
  status: 'scheduled' | 'paid'
  status_display: string
  paid_on: string | null
  payment_method: number | null
  payment_method_label: string | null
  notes: string
}

/** A row in the staff pay table. */
export interface PayrollPerson {
  id: number
  name: string
  email: string
  role: Role
  role_display: string
  department_name: string | null
  is_active_crew: boolean
  pay_rate: PayRate | null
  paid_to_date: string
  last_paid_on: string | null
  next_paycheck: { id: number; pay_date: string; total: string } | null
  unreimbursed: { count: number; total: string }
}

export interface PayrollPersonDetail extends PayrollPerson {
  paychecks: Paycheck[]
  receipts: ReceiptSummary[]
}

export interface FinanceOverview {
  today: string
  invoices_due: Invoice[]
  due_this_week: string
  next_payroll: { pay_date: string; count: number; total: string } | null
  upcoming_paychecks: Paycheck[]
  receipts: {
    id: number
    title: string
    person: string | null
    person_id: number | null
    amount: string | null
    status: ReceiptStatus
    status_display: string
    submitted_on: string
  }[]
  auto_drafts: AutoDraft[]
  month: { incoming: string; outgoing: string }
}

export type FinanceCalendarKind = 'invoice' | 'payroll' | 'draft' | 'deposit'

export interface FinanceCalendarItem {
  date: string
  kind: FinanceCalendarKind
  title: string
  amount: string
  done: boolean
  link: string
}

/** A row in the Task Manager's master staff list. */
export interface StaffOverviewRow {
  id: number
  name: string
  first_name: string
  email: string
  phone: string
  role: Role
  role_display: string
  department: number | null
  department_name: string | null
  is_active_crew: boolean
  lodging: string
  tasks: { open: number; overdue: number; done: number }
  next_event: { id: number; title: string; start: string; end: string; all_day: boolean; location: string } | null
  hours_this_week: number
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

/** A row in the roster table. */
export interface InfluencerRow extends InfluencerSummary {
  phone: string
  email: string
  agent_name: string
  travel_count: number
  /** The next travel arrangement that hasn't started yet. */
  next_travel_at: string | null
  /** The next schedule item that hasn't ended yet. */
  next_event_at: string | null
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
