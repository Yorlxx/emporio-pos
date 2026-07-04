import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, password, nombre, rol } = await request.json()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Verificación de seguridad por si las variables no cargaron
    if (!url || !serviceKey) {
      return NextResponse.json({ 
        error: 'Faltan las variables de entorno en el servidor. Asegúrate de reiniciar la terminal con npm run dev.' 
      }, { status: 500 })
    }

    // Inicializar el cliente administrador
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 1. Crear usuario en el búnker de Autenticación
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Crear fila en la tabla de perfiles
    const { error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .insert([
        {
          id: authData.user.id,
          correo_interno: email,
          nombre: nombre,
          rol: rol
        }
      ])

    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Usuario creado con éxito' }, { status: 200 })

  } catch (err) {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}