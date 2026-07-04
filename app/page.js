'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  
  // REINSTALADO - Estado para controlar la visibilidad de la contraseña
  const [showPassword, setShowPassword] = useState(false)
  
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    // 1. Autenticar las credenciales en el búnker de Supabase Auth
    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      setErrorMsg('Correo o contraseña incorrectos.')
      setLoading(false)
      return
    }

    if (session) {
      // 2. Traer el rol real inyectado en la tabla de perfiles
      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single()

      if (perfilError || !perfil) {
        await supabase.auth.signOut()
        setErrorMsg('Error de sincronización: No se encontró tu perfil en la base de datos.')
        setLoading(false)
        return
      }

      // 3. Enrutador Inteligente por Roles
      if (perfil.rol === 'trabajador') {
        router.push('/ventas') 
      } else if (perfil.rol === 'admin' || perfil.rol === 'supervisor') {
        router.push('/dashboard') 
      } else {
        await supabase.auth.signOut()
        setErrorMsg('Tu usuario no cuenta con un rol asignado en el sistema.')
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900/60 border border-white/5 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">EMPORIO</h1>
          <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold mt-1">Acceso al Sistema POS</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-xs text-center rounded-xl font-medium animate-fadeIn">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">Correo Corporativo</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@emporio.com"
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-700"
              required 
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">Llave de Acceso</label>
            {/* Contenedor relativo para posicionar el botón del ojo */}
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-12 py-2.5 bg-slate-950 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-slate-700"
                required 
              />
              {/* REINSTALADO - Botón interactivo con el ojito */}
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors text-sm select-none"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white font-bold text-xs tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-indigo-950/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Validando Credenciales...' : 'Ingresar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}