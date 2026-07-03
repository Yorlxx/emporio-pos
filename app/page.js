'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      
      {/* Orbes de luz decorativos de fondo (Estilo Cyberpunk/Elegante) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Tarjeta con efecto de cristal (Glassmorphism) */}
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/5 shadow-2xl p-10 relative z-10 transition-all duration-300">
        
        {/* Encabezado Estilizado */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 drop-shadow-sm">
            EMPORIO
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-semibold mt-2">
            Sistema de Gestión Comercial
          </p>
        </div>

        {/* Alerta de Error Elegante */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs tracking-wide text-center backdrop-blur-sm animate-fade-in">
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-950/60 border border-white/5 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-300 text-sm"
              placeholder="••••••••"
              required
              disabled={loading}
            />
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