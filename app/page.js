'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // Estado para el ojito
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    setLoading(false)

    if (error) {
      setErrorMessage('Las credenciales ingresadas no son válidas.')
    } else {
      alert('¡Inicio de sesión exitoso! Redireccionando...')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Orbes de luz decorativos de fondo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Tarjeta con efecto de cristal */}
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl p-10 relative z-10">
        
        {/* Encabezado Estilizado */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 drop-shadow-sm">
            EMPORIO
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-semibold mt-2">
            Sistema de Gestión Comercial
          </p>
        </div>

        {/* Alerta de Error */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs tracking-wide text-center backdrop-blur-sm">
            {errorMessage}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-2.5">
              Identificación / Email
            </label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300 text-sm"
              placeholder="nombre@empresa.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-slate-400 font-medium mb-2.5">
              Clave de Acceso
            </label>
            {/* Contenedor relativo para posicionar el ojo en la esquina derecha */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300 text-sm"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              
              {/* Botón interactivo del ojito */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors focus:outline-none"
              >
                {showPassword ? (
                  /* Icono Ojo Tachado (Ocultar) */
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 1-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  /* Icono Ojo Abierto (Ver) */
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Botón de Acción Principal */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/10 transition-all duration-300 transform active:scale-[0.99] tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'AUTENTICANDO...' : 'INGRESAR AL SISTEMA'}
          </button>
            </form>

          </div>
        </div>
      )
    }