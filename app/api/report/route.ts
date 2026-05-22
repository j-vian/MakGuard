import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { target_value, value_type, threat_type, reporter_notes } = body

    if (!target_value || !value_type || !threat_type) {
      return NextResponse.json(
        { error: 'target_value, value_type, and threat_type are required' },
        { status: 400 }
      )
    }

    if (!['phone', 'account', 'url'].includes(value_type)) {
      return NextResponse.json(
        { error: 'value_type must be phone, account, or url' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabaseAdmin
      .from('scam_reports')
      .select('id, report_count')
      .eq('target_value', target_value.trim())
      .eq('value_type', value_type)
      .single()

    if (existing) {
      const { error } = await supabaseAdmin
        .from('scam_reports')
        .update({ report_count: existing.report_count + 1 })
        .eq('id', existing.id)

      if (error) throw error

      return NextResponse.json(
        { message: 'Report count updated. Thank you for keeping Malaysia safe.' },
        { status: 200 }
      )
    }

    const { error } = await supabaseAdmin
      .from('scam_reports')
      .insert({
        target_value: target_value.trim(),
        value_type,
        threat_type,
        reporter_notes: reporter_notes || null,
        source: 'community_report',
        is_verified: false
      })

    if (error) throw error

    return NextResponse.json(
      { message: 'Scam reported successfully. Thank you for keeping Malaysia safe.' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}