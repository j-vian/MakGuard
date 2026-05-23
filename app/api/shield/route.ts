import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ShieldResult } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { value, value_type } = body

    if (!value || !value_type) {
      return NextResponse.json(
        { error: 'Value and value_type are required' },
        { status: 400 }
      )
    }

    if (!['phone', 'account', 'url'].includes(value_type)) {
      return NextResponse.json(
        { error: 'value_type must be phone, account, or url' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('scam_reports')
      .select('*')
      .eq('target_value', value.trim())
      .eq('value_type', value_type)
      .single()

    if (error || !data) {
      const result: ShieldResult = {
        is_flagged: false,
        report_count: 0,
        threat_type: null,
        source: null,
        message: 'No threats detected. This appears to be safe.'
      }
      return NextResponse.json(result, { status: 200 })
    }

    const result: ShieldResult = {
      is_flagged: true,
      report_count: data.report_count,
      threat_type: data.threat_type,
      source: data.source,
      message: `Warning: This ${value_type} has been reported ${data.report_count} times for ${data.threat_type.replace(/_/g, ' ')}.`
    }

    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('Shield API error:', error)
    return NextResponse.json(
      { error: 'Failed to verify account' },
      { status: 500 }
    )
  }
}