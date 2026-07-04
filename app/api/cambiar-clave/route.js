import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function PUT(request) {
  try {
    const { id, nuevaPassword } = await request.json()

    if (!id || !nuevaPassword || nuevaPassword.length < 6) {
      return NextResponse.json({ error: 'Datos inválidos. La clave debe tener mínimo 6 caracteres.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Forzar el cambio de contraseña en el búnker de autenticación usando el ID
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { password: nuevaPassword }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Contraseña actualizada con éxito' }, { status: 200 })

  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}