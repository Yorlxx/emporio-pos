import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request) {
  try {
    const { id } = await request.json()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Faltan variables de entorno en el servidor.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Eliminar de la tabla pública 'perfiles'
    const { error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .delete()
      .eq('id', id)

    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 400 })
    }

    // 2. Eliminar del búnker de Autenticación (Esto libera el correo al 100%)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Usuario purgado con éxito' }, { status: 200 })

  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}