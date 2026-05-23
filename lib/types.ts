export interface ScamReport {
    id: string
    created_at: string
    target_value: string
    value_type: 'phone' | 'account' | 'url'
    threat_type: string
    report_count: number
    source: 'pdrm_seed' | 'nsrc_seed' | 'community_report'
    reporter_notes: string | null
    is_verified: boolean
  }
  
  export interface ScanResult {
    score: number
    flags: string[]
    recommendation: string
  }
  
  export interface ShieldResult {
    is_flagged: boolean
    report_count: number
    threat_type: string | null
    source: string | null
    message: string
  }