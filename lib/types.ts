export interface ScamReport {
  id: string
  created_at: string
  target_value: string
  value_type: 'phone' | 'account' | 'url'
  threat_type: string
  report_count: number
  source: 'pdrm_seed' | 'nsrc_seed' | 'community_report'
  reporter_notes: string | null
  evidence_url: string | null
  is_verified: boolean
}

export interface EvidenceGalleryItem {
  id: string
  target_value: string
  value_type: string
  threat_type: string
  evidence_url: string
  created_at: string
}
  
  export interface ScanResult {
    risk_score: number
    threat_tags: string[]
    explanation: string
    confidence: 'low' | 'medium' | 'high'
  }
  
  export interface ShieldResult {
    is_flagged: boolean
    report_count: number
    threat_type: string | null
    source: string | null
    message: string
  }