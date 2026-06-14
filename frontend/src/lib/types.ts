export interface Channel {
  name: string;
  description: string;
  active_niches: string[];
  youtube_secret: string;
  voice_short: string;
  voice_long: string;
  palette: { primary: string; accent: string };
  category_id: string;
  default_language: string;
  active: boolean;
}

export interface Niche {
  label: string;
  series: string;
  subreddits: string[];
  subjects: string;
  color: string;
}

export interface CalendarSlot {
  weekday: number;
  hour: number;
  format: "short" | "long";
  niche: string | null;
  label: string;
}

export interface CalendarConfig {
  weekly_plan: CalendarSlot[];
  short_rotation: string[];
  long_rotation: string[];
  timezone: string;
}

export interface Idea {
  id: string;
  text: string;
  niche: string | null;
  format: "short" | "long" | null;
  hook?: string | null;
  created_at: string;
  starred: boolean;
  status: "inbox" | "promoted" | "produced";
}

export interface Settings {
  production: {
    images_per_short: number;
    images_per_long: number;
    fps: number;
    short_resolution: string;
    long_resolution: string;
    music_volume_db: number;
    subtitle_font: string;
    trending_ratio: number;
  };
  tts: {
    model_id: string;
    stability: number;
    similarity_boost: number;
  };
  youtube: {
    category_id: string;
    default_language: string;
    made_for_kids: boolean;
    privacy_status: string;
  };
  thresholds: {
    ctr_alarm: number;
    avd_alarm: number;
    shorts_apv_target: number;
    max_videos_per_day: number;
  };
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  event: string;
}

export interface UpcomingSlot {
  publish_at: string;
  format: "short" | "long";
  niche: string;
  niche_label: string;
  niche_color: string;
  day_label: string;
}

/** Per-published-video performance record (frontend-owned, additive). */
export interface VideoPerf {
  id: string;
  title: string;
  youtube_url: string;
  niche: string | null;
  format: "short" | "long";
  hook?: string | null;
  published_at: string; // ISO date
  views: number;
  ctr: number; // %
  retention: number; // average view %, AVD proxy
  apv: number; // shorts average % viewed
  subs_gained: number;
  notes?: string;
}

export interface PerformanceData {
  videos: VideoPerf[];
}

/** Weekly command-ritual decision log (frontend-owned, additive). */
export interface WeeklyDecision {
  id: string;
  week_of: string; // ISO date (Monday)
  best_video: string;
  worst_video: string;
  diagnosis: string;
  variable_changed: string; // the single change for the week
  created_at: string;
}

export interface DecisionsData {
  decisions: WeeklyDecision[];
  // Channel growth markers for the monetization / phase tracker.
  subscribers?: number;
  watch_hours?: number;
  shorts_views_90d?: number;
}
