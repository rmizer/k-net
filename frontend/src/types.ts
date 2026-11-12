// Shapes returned by the Django API.

import type { Role, User } from './auth/roles'

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
  created_by: number | null
  created_by_name: string | null
  created_at: string
  completed_at: string | null
}

export type EventType = 'production' | 'staff' | 'influencer' | 'support' | 'other'

export interface CalendarEvent {
  id: number
  title: string
  description: string
  /** Who it's for, as the call sheet's "Talent / Crew" column puts it. */
  talent_crew: string
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

/** Someone working on a day, by the schedule, with their first call. */
export interface CrewMember extends User {
  call: {
    event: number
    title: string
    /** "HH:MM" production time; null for an all-day item. */
    time: string | null
    location: string
  }
}

export interface CrewDay {
  date: string
  crew: CrewMember[]
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
  /** Last four digits, or five for American Express. */
  last_digits: string
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
  room_number: string
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
  /** The newest call sheet published from the Call Sheet Generator. */
  latest_call_sheet: CallSheetSummary | null
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
  /** The show they're on and their current (latest) week on it. */
  show: number | null
  show_name: string | null
  season: number | null
  week: number | null
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
  allergies: string
  food_allergies: string
  notes: InfluencerNote[]
  travel: TravelArrangement[]
  upcoming_events: { id: number; title: string; start: string; end: string; all_day: boolean; location: string }[]
}

export type ShowStatus = 'planning' | 'pre_production' | 'production' | 'hiatus' | ''

export const SHOW_STATUSES: { value: Exclude<ShowStatus, ''>; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'pre_production', label: 'Pre-production' },
  { value: 'production', label: 'Production' },
  { value: 'hiatus', label: 'Hiatus' },
]

export interface ShowPerson {
  id: number
  name: string
  head_of_department_name: string | null
}

/** A show the production runs or Directors are brainstorming. */
export interface Show {
  id: number
  name: string
  description: string
  start_date: string | null
  shooting_location: string
  status: ShowStatus
  status_display: string
  seasons: number | null
  weeks_per_season: number | null
  director: number | null
  director_name: string | null
  other_directors: number[]
  other_director_details: ShowPerson[]
  department_heads: number[]
  department_head_details: ShowPerson[]
  influencer_count: number
  updated_at: string
}

/** A Director's or Assistant's request for a Site Manager to remove someone. */
export interface RemovalRequest {
  id: number
  person: number
  person_name: string
  person_email: string
  person_role_display: string
  requested_by_name: string | null
  reason: string
  status: 'pending' | 'approved' | 'dismissed'
  created_at: string
}

/** Minutes from one meeting (Site Managers, Directors and Assistants only). */
export interface MeetingNote {
  id: number
  title: string
  meeting_at: string
  attendees: number[]
  attendee_names: string[]
  notes: string
  created_by_name: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

/** Someone as a department page shows them. */
export interface PagePerson {
  id: number
  name: string
  first_name: string
  last_name: string
  title: string
  role: Role
  role_display: string
  department: number | null
  department_name: string | null
  phone: string
  email: string
  profile_picture: string | null
  is_active_crew: boolean
  is_head: boolean
}

/** One department page (Departments menu). `head_tasks` is null for people who
 *  aren't allowed to see the heads' own tasks. */
export interface DepartmentPageData {
  slug: string
  label: string
  can_edit: boolean
  is_head: boolean
  departments: { id: number; name: string }[]
  heads: PagePerson[]
  crew: PagePerson[]
  head_tasks: Task[] | null
  staff_tasks: Task[]
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'beverage'

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'beverage', label: 'Beverage' },
]

export type ShoppingCategory =
  | 'meat'
  | 'produce'
  | 'dairy'
  | 'bakery'
  | 'dietary'
  | 'pantry'
  | 'frozen'
  | 'beverages'
  | 'paper'
  | 'tools'
  | 'other'

/** Shopping list sections, in store order. */
export const SHOPPING_CATEGORIES: { value: ShoppingCategory; label: string }[] = [
  { value: 'meat', label: 'Meat & seafood' },
  { value: 'produce', label: 'Fruit & vegetables' },
  { value: 'dairy', label: 'Dairy & eggs' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'dietary', label: 'Dietary products' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'paper', label: 'Paper products' },
  { value: 'tools', label: 'Tools & equipment' },
  { value: 'other', label: 'Other' },
]

export interface Ingredient {
  /** Missing until the menu item is saved. */
  id?: number
  name: string
  quantity: string
  category: ShoppingCategory
  /** Shopping lists it's already on. */
  on_lists?: number[]
}

export interface MenuItem {
  id: number
  name: string
  date: string
  meal: MealType
  meal_display: string
  notes: string
  ingredients: Ingredient[]
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface ShoppingItem {
  id: number
  shopping_list: number
  name: string
  quantity: string
  category: ShoppingCategory
  category_display: string
  /** What it's for, e.g. "Chili · Dinner, Oct 23". */
  meal: string
  /** The menu ingredient it came from, if any. */
  ingredient: number | null
  checked: boolean
}

export interface ShoppingList {
  id: number
  store: string
  needed_by: string | null
  notes: string
  item_count: number
  checked_count: number
  created_by_name: string | null
  created_at: string
  updated_at: string
  /** Only on a single list. */
  items?: ShoppingItem[]
}

/** A row on Culinary's Food allergies page: a staff or crew member, or an influencer. */
export interface FoodAllergyPerson {
  kind: 'staff' | 'influencer'
  id: number
  name: string
  role_display: string
  title: string
  department_name: string | null
  is_active_crew: boolean
  show_name: string | null
  food_allergies: string
}

/** GET /culinary/food-allergies/ */
export interface FoodAllergies {
  people: FoodAllergyPerson[]
  /** Everyone on the project (active staff, crew and influencers). */
  total: number
}

/** A call sheet published to the Staff Hub (Add to announcements). */
export interface CallSheetSummary {
  id: number
  title: string
  day: string
  published_by_name: string | null
  published_at: string
}

export interface PublishedCallSheet extends CallSheetSummary {
  /** The sheet as published, edits included; cleaned by the server. */
  html: string
}

// Challenge Planner

export type ChallengeStatus = 'planning' | 'planned' | 'complete'

export const CHALLENGE_STATUSES: { value: ChallengeStatus; label: string }[] = [
  { value: 'planning', label: 'In planning' },
  { value: 'planned', label: 'Planned' },
  { value: 'complete', label: 'Complete' },
]

export type SafetyCheck = 'todo' | 'done' | 'not_needed'

export const SAFETY_CHECK_OPTIONS: { value: SafetyCheck; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'done', label: 'Done' },
  { value: 'not_needed', label: 'Not needed' },
]

/** The safety checklist: none can be To do once a challenge is Planned or Complete. */
export const SAFETY_CHECKS = [
  { field: 'waivers', label: 'Waivers signed' },
  { field: 'allergy_check', label: 'Allergy check done' },
  { field: 'medic', label: 'Medic booked' },
] as const

export type SafetyCheckField = (typeof SAFETY_CHECKS)[number]['field']

export type ChallengeLocation = 'backyard' | 'pool' | 'indoors' | 'kitchen' | 'off_site' | 'other' | ''

export const CHALLENGE_LOCATIONS: { value: Exclude<ChallengeLocation, ''>; label: string }[] = [
  { value: 'backyard', label: 'Backyard' },
  { value: 'pool', label: 'Pool area' },
  { value: 'indoors', label: 'Indoors' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'off_site', label: 'Off-site' },
  { value: 'other', label: 'Other' },
]

export const CONTENT_WARNINGS = [
  { value: 'eating_insects', label: 'Eating insects' },
  { value: 'gross_food', label: 'Gross-out food' },
  { value: 'vomiting', label: 'Vomiting' },
  { value: 'mess', label: 'Mud, slime and mess' },
  { value: 'physical_contact', label: 'Wrestling / physical contact' },
  { value: 'injury_risk', label: 'Risk of minor injury' },
  { value: 'phobias', label: 'Phobias (bugs, heights, tight spaces)' },
  { value: 'flashing_lights', label: 'Flashing lights' },
] as const

export type ContentWarning = (typeof CONTENT_WARNINGS)[number]['value']

export type SupplyCategory = 'props' | 'tech' | 'wardrobe' | 'food' | 'prizes' | 'safety' | 'other'

export const SUPPLY_CATEGORIES: { value: SupplyCategory; label: string }[] = [
  { value: 'props', label: 'Props & set' },
  { value: 'tech', label: 'Tech & equipment' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'food', label: 'Food & drink' },
  { value: 'prizes', label: 'Prizes' },
  { value: 'safety', label: 'Safety & first aid' },
  { value: 'other', label: 'Other' },
]

export interface SupplyItem {
  /** Missing until the challenge is saved. */
  id?: number
  name: string
  quantity: string
  category: SupplyCategory
  note: string
  checked: boolean
}

export interface Challenge {
  id: number
  name: string
  date: string
  show: number | null
  show_name: string | null
  week: number | null
  description: string
  participants: number[]
  participant_names: string[]
  rewards: string
  location: ChallengeLocation
  location_display: string
  location_details: string
  cleanup_plan: string
  cleanup_owner: number | null
  cleanup_owner_name: string | null
  waivers: SafetyCheck
  allergy_check: SafetyCheck
  medic: SafetyCheck
  /** Labels of the safety checks still To do. */
  safety_to_do: string[]
  content_warnings: ContentWarning[]
  other_content_warnings: string
  status: ChallengeStatus
  status_display: string
  supplies: SupplyItem[]
  created_by_name: string | null
  created_at: string
  updated_at: string
}

// Security incident reports

export type IncidentCategory =
  | 'breach'
  | 'trespass'
  | 'fan'
  | 'threat'
  | 'altercation'
  | 'theft'
  | 'damage'
  | 'medical'
  | 'hazard'
  | 'other'

export const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string }[] = [
  { value: 'breach', label: 'Security breach / unauthorized access' },
  { value: 'trespass', label: 'Trespassing' },
  { value: 'fan', label: 'Fan or stalker' },
  { value: 'threat', label: 'Threat or harassment' },
  { value: 'altercation', label: 'Fight or altercation' },
  { value: 'theft', label: 'Theft or missing property' },
  { value: 'damage', label: 'Property damage' },
  { value: 'medical', label: 'Injury or medical' },
  { value: 'hazard', label: 'Fire or safety hazard' },
  { value: 'other', label: 'Other' },
]

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export const INCIDENT_SEVERITIES: { value: IncidentSeverity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export type IncidentStatus = 'open' | 'investigating' | 'resolved'

export const INCIDENT_STATUSES: { value: IncidentStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
]

export interface IncidentAttachment {
  id: number
  /** Streams the file; add ?download=1 to save it. */
  url: string
  file_name: string
  kind: 'image' | 'video' | 'file'
  size: number | null
  caption: string
  uploaded_by: number | null
  uploaded_by_name: string | null
  created_at: string
}

export interface IncidentReport {
  id: number
  title: string
  category: IncidentCategory
  category_display: string
  severity: IncidentSeverity
  severity_display: string
  occurred_at: string
  location: string
  description: string
  people_involved: string
  witnesses: string
  actions_taken: string
  police_called: boolean
  police_report_number: string
  status: IncidentStatus
  status_display: string
  resolution: string
  reported_by: number | null
  reported_by_name: string | null
  /** The reporter while it's Open, and the Security head(s) and managers always. */
  can_edit: boolean
  attachments: IncidentAttachment[]
  /** Managers and the Security head were alerted (High and Critical reports). */
  alerted: boolean
  created_at: string
  updated_at: string
}

// Inventory

/** What kind of thing an item is, across departments. */
export const ITEM_TYPES = [
  { value: 'food', label: 'Food' },
  { value: 'cookware', label: 'Cookware & serving' },
  { value: 'disposables', label: 'Disposables' },
  { value: 'cleaning', label: 'Cleaning supplies' },
  { value: 'equipment', label: 'Equipment & gear' },
  { value: 'tools', label: 'Tools & rigging' },
  { value: 'office', label: 'Office supplies' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
] as const

export type ItemType = (typeof ITEM_TYPES)[number]['value']

export const QUANTITY_UNITS = [
  { value: 'units', label: 'Unit(s)' },
  { value: 'packages', label: 'Packages' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'cases', label: 'Cases' },
  { value: 'containers', label: 'Containers' },
  { value: 'bags', label: 'Bags' },
  { value: 'bunches', label: 'Bunches' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'cans', label: 'Cans' },
  { value: 'jars', label: 'Jars' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'packs', label: 'Packs' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'sets', label: 'Sets' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'gross', label: 'Gross (144)' },
] as const

export type QuantityUnit = (typeof QUANTITY_UNITS)[number]['value']

/** Size units, grouped for the drop-down. `short` is how sizes read, e.g. "32 oz". */
export const SIZE_UNIT_GROUPS = [
  {
    label: 'Imperial / US',
    units: [
      { value: 'oz', label: 'oz (ounces)', short: 'oz' },
      { value: 'lb', label: 'lb (pounds)', short: 'lb' },
      { value: 'fl_oz', label: 'fl oz (fluid ounces)', short: 'fl oz' },
      { value: 'cup', label: 'cups', short: 'cups' },
      { value: 'pt', label: 'pt (pints)', short: 'pt' },
      { value: 'qt', label: 'qt (quarts)', short: 'qt' },
      { value: 'gal', label: 'gal (gallons)', short: 'gal' },
      { value: 'in', label: 'in (inches)', short: 'in' },
      { value: 'ft', label: 'ft (feet)', short: 'ft' },
      { value: 'yd', label: 'yd (yards)', short: 'yd' },
    ],
  },
  {
    label: 'Metric',
    units: [
      { value: 'mg', label: 'mg (milligrams)', short: 'mg' },
      { value: 'g', label: 'g (grams)', short: 'g' },
      { value: 'kg', label: 'kg (kilograms)', short: 'kg' },
      { value: 'ml', label: 'mL (milliliters)', short: 'mL' },
      { value: 'l', label: 'L (liters)', short: 'L' },
      { value: 'mm', label: 'mm (millimeters)', short: 'mm' },
      { value: 'cm', label: 'cm (centimeters)', short: 'cm' },
      { value: 'm', label: 'm (meters)', short: 'm' },
    ],
  },
] as const

export type SizeUnit = (typeof SIZE_UNIT_GROUPS)[number]['units'][number]['value']

export interface ReceiptSummary {
  id: number
  title: string
  vendor: string
  amount: string | null
  purchase_date: string | null
  file_name: string
  url: string
}

export interface InventoryItem {
  id: number
  name: string
  /** Null means Other. */
  department: number | null
  department_name: string
  item_type: ItemType
  item_type_display: string
  purchased_on: string | null
  expires_on: string | null
  receipt: number | null
  receipt_details: ReceiptSummary | null
  /** Decimal as a string, e.g. "2.00". */
  quantity: string
  quantity_unit: QuantityUnit
  quantity_unit_display: string
  /** Optional count of the individual things, e.g. 12 (bananas) in 2 bunches. */
  piece_count: number | null
  piece_label: string
  size: string | null
  size_unit: SizeUnit | ''
  size_unit_display: string
  storage_location: string
  details: string
  brand: string
  model_number: string
  /** One per line. */
  serial_numbers: string
  asset_tag: string
  warranty_expires: string | null
  in_stock: boolean
  created_by_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by_name: string | null
}

// Vehicles

export const VEHICLE_KINDS = [
  { value: 'party_bus', label: 'Party bus' },
  { value: 'shuttle_bus', label: 'Shuttle bus' },
  { value: 'van', label: 'Van / passenger van' },
  { value: 'moving_truck', label: 'Moving truck (U-Haul, Penske…)' },
  { value: 'box_truck', label: 'Box truck / grip truck' },
  { value: 'pickup', label: 'Pickup truck' },
  { value: 'car', label: 'Car / SUV' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'cart', label: 'Golf cart / utility cart' },
  { value: 'other', label: 'Other' },
] as const

export type VehicleKind = (typeof VEHICLE_KINDS)[number]['value']

export const VEHICLE_OWNERSHIP = [
  { value: 'rented', label: 'Rented' },
  { value: 'leased', label: 'Leased' },
  { value: 'owned', label: 'Owned' },
] as const

export type VehicleOwnership = (typeof VEHICLE_OWNERSHIP)[number]['value']

export const VEHICLE_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'out_of_service', label: 'Out of service' },
  { value: 'returned', label: 'Returned' },
] as const

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]['value']

export interface VehicleDocument {
  id: number
  title: string
  category: DocumentCategory
  category_display: string
  vendor: string
  amount: string | null
  purchase_date: string | null
  file_name: string
  uploaded_by_name: string | null
  created_at: string
  /** Opens through the vehicle, for anyone who can see it. */
  url: string
}

export interface Vehicle {
  id: number
  name: string
  kind: VehicleKind
  kind_display: string
  description: string
  make_model: string
  year: number | null
  color: string
  vin: string
  license_plate: string
  plate_state: string
  ownership: VehicleOwnership
  ownership_display: string
  rented_from: string
  rental_reference: string
  rented_on: string | null
  return_by: string | null
  return_to: string
  storage_location: string
  keys_location: string
  driver: number | null
  driver_name: string | null
  status: VehicleStatus
  status_display: string
  documents: number[]
  document_details: VehicleDocument[]
  /** Linked receipts added up, e.g. "396.65". */
  receipt_total: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}
