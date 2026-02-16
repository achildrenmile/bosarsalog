export interface BezirkStat {
  bundesland: string;
  bundesland_code: string;
  bezirk_code: string;
  bezirk_name: string;
  is_capital: number;
  participants: number;
  reports: number;
}

export interface Participant {
  callsign: string;
  name: string | null;
  bezirk_code: string | null;
  bundesland_code: string | null;
  bundesland_name: string | null;
  report_count: number;
}

export interface RepeaterStat {
  short_name: string;
  count: number;
}

export interface BlStat {
  bundesland: string;
  bundesland_code: string;
  participants: number;
  reports: number;
}

export interface Stats {
  totalParticipants: number;
  totalReports: number;
  perRepeater: RepeaterStat[];
  bezirkStats: BezirkStat[];
  blStats: BlStat[];
  participants: Participant[];
}
