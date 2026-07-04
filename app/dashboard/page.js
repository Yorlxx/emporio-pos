'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const router = useRouter()

  // ─── ESTADOS DE SESIÓN Y NAVEGACIÓN ───
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')

  // ─── ESTADOS DE DATOS EN TIEMPO REAL ───
  const [listaUsuarios, setListaUsuarios] = useState([])
  const [listaProductos, setListaProductos] = useState([])
  const [listaCaseros, setListaCaseros] = useState([])
  const [ventasNubeHoy, setVentasNubeHoy] = useState([])
  
  // 🔥 NUEVO ESTADO: Historial Global de Ventas
  const [historialVentas, setHistorialVentas] = useState([])
  const [buscarTicket, setBuscarTicket] = useState('')

  // ─── ESTADOS FORMULARIOS: INVENTARIO ───
  const [nombreProd, setNombreProd] = useState('')
  const [codigo, setCodigo] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [precioCosto, setPrecioCosto] = useState('')
  const [stockActual, setStockActual] = useState('')
  const [savingProd, setSavingProd] = useState(false)

  // ─── ESTADOS FORMULARIOS: PERSONAL ───
  const [empNombre, setEmpNombre] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [empPassword, setEmpPassword] = useState('')
  const [empRol, setEmpRol] = useState('trabajador')
  const [showEmpPassword, setShowEmpPassword] = useState(false)
  const [savingEmp, setSavingEmp] = useState(false)

  // ─── ESTADOS MODALES DE CONTROL ADMIN ───
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  
  const [modalResetOpen, setModalResetOpen] = useState(false)
  const [resetUser, setResetUser] = useState({ id: '', nombre: '' })
  const [nuevaClaveInput, setNuevaClaveInput] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  
  const [modalDeleteOpen, setModalDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState({ id: '', nombre: '' })
  const [deleteSaving, setDeleteSaving] = useState(false)

  const [modalEditProdOpen, setModalEditProdOpen] = useState(false)
  const [editProdTarget, setEditProdTarget] = useState({ id: null, nombre: '', codigo_barras: '', precio_costo: 0, precio_venta: 0, stock_actual: 0 })

  // ─── FUNCIONES CORE ───
  const mostrarNotificacion = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000)
  }

  const cargarDatosMaestros = async () => {
    // 1. Personal Completo
    const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, correo_interno, rol, is_online').order('id', { ascending: true })
    if (perfiles) setListaUsuarios(perfiles)

    // 2. Inventario Total
    const { data: prods } = await supabase.from('productos').select('*').order('nombre', { ascending: true })
    if (prods) setListaProductos(prods)

    // 3. Caseros
    const { data: caseros } = await supabase.from('clientes_frecuentes').select('*').order('id', { ascending: false })
    if (caseros) setListaCaseros(caseros)

    // 4. Ventas Nube Hoy (Para el Resumen)
    const hoy = new Date().toISOString().split('T')[0]
    const { data: ventasHoy } = await supabase.from('ventas_nube').select('*').gte('creado_en', `${hoy}T00:00:00Z`).order('creado_en', { ascending: false })
    if (ventasHoy) setVentasNubeHoy(ventasHoy)

    // 5. 🔥 NUEVO: Historial Global de Tickets (Últimos 100 comprobantes para auditoría)
    const { data: historialGlobal } = await supabase.from('ventas_nube').select('*').order('creado_en', { ascending: false }).limit(100)
    if (historialGlobal) setHistorialVentas(historialGlobal)
  }

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/')
      
      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()

      if (perfil?.rol === 'admin' || perfil?.rol === 'supervisor') {
        setUser(session.user); setUserRole(perfil.rol); setLoading(false)
        cargarDatosMaestros()
      } else {
        await supabase.auth.signOut(); router.push('/')
      }
    }
    checkUser()
  }, [router])

  useEffect(() => {
    if (userRole) {
      const interval = setInterval(() => cargarDatosMaestros(), 8000)
      return () => clearInterval(interval)
    }
  }, [userRole])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ─── OPERACIONES DE INVENTARIO (CRUD) ───
  const handleAddProducto = async (e) => {
    e.preventDefault()
    if (userRole !== 'admin') return mostrarNotificacion('Solo el Administrador puede crear productos.', 'error')
    setSavingProd(true)
    
    const codigoFinal = codigo.trim() !== '' ? codigo : Math.floor(10000000 + Math.random() * 90000000).toString()

    const { error } = await supabase.from('productos').insert([{ 
      nombre: nombreProd, codigo_barras: codigoFinal, 
      precio_costo: parseFloat(precioCosto) || 0, precio_venta: parseFloat(precioVenta) || 0, 
      stock_actual: parseInt(stockActual) || 0, stock_minimo: 5 
    }])
    
    setSavingProd(false)
    if (!error) { 
      mostrarNotificacion(`Producto guardado. Código asignado: ${codigoFinal}`); 
      setNombreProd(''); setCodigo(''); setPrecioCosto(''); setPrecioVenta(''); setStockActual(''); 
      cargarDatosMaestros() 
    } else { mostrarNotificacion(`Error: ${error.message}`, 'error') }
  }

  const handleGuardarEdicionProducto = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('productos').update({
      nombre: editProdTarget.nombre, codigo_barras: editProdTarget.codigo_barras,
      precio_costo: parseFloat(editProdTarget.precio_costo) || 0, precio_venta: parseFloat(editProdTarget.precio_venta) || 0, 
      stock_actual: parseInt(editProdTarget.stock_actual) || 0
    }).eq('id', editProdTarget.id)
    
    if (!error) { mostrarNotificacion('Catálogo actualizado.'); setModalEditProdOpen(false); cargarDatosMaestros() }
  }

  const handleEliminarProducto = async (id, nombre) => {
    if(confirm(`⚠️ CUIDADO: ¿Eliminar permanentemente "${nombre}" de la base de datos?`)) {
      const { error } = await supabase.from('productos').delete().eq('id', id)
      if (!error) { mostrarNotificacion('Producto fulminado.'); cargarDatosMaestros() }
      else { mostrarNotificacion('Error al eliminar.', 'error') }
    }
  }

  // ─── OPERACIONES DE PERSONAL ───
  const openResetModal = (userId, nombre) => { setResetUser({ id: userId, nombre: nombre }); setNuevaClaveInput(''); setModalResetOpen(true) }
  const openDeleteModal = (userId, nombre) => { setDeleteTarget({ id: userId, nombre: nombre }); setModalDeleteOpen(true) }

  const handleLimpiarFormularioPersonal = () => {
    setEmpNombre(''); setEmpEmail(''); setEmpPassword(''); setEmpRol('trabajador');
    mostrarNotificacion('Formulario de alta limpiado.', 'success')
  }

  const handleUpdateRole = async (userId, nuevoRol) => {
    if (userRole !== 'admin') return mostrarNotificacion('Acción denegada.', 'error')
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', userId)
    if (!error) { mostrarNotificacion('Rango actualizado.'); cargarDatosMaestros() }
  }

  const handleAddPersonal = async (e) => {
    e.preventDefault()
    if (userRole !== 'admin') return
    setSavingEmp(true)
    const response = await fetch('/api/crear-usuario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: empEmail, password: empPassword, nombre: empNombre, rol: empRol }) })
    setSavingEmp(false)
    if (response.ok) { mostrarNotificacion(`¡${empNombre} registrado!`); handleLimpiarFormularioPersonal(); cargarDatosMaestros() }
    else { mostrarNotificacion('Error al crear usuario. Verifica el correo.', 'error') }
  }

  const handleConfirmResetPassword = async (e) => {
    e.preventDefault()
    if (userRole !== 'admin') return
    setResetSaving(true)
    const response = await fetch('/api/cambiar-clave', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: resetUser.id, nuevaPassword: nuevaClaveInput }) })
    setResetSaving(false)
    if (response.ok) { mostrarNotificacion('Clave reescrita con éxito.'); setModalResetOpen(false) }
    else { mostrarNotificacion('Error del servidor al cambiar clave.', 'error') }
  }

  const handleConfirmDeleteUser = async () => {
    if (userRole !== 'admin') return
    setDeleteSaving(true)
    const response = await fetch('/api/eliminar-usuario', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteTarget.id }) })
    setDeleteSaving(false); setModalDeleteOpen(false)
    if (response.ok) { mostrarNotificacion('Usuario removido.'); cargarDatosMaestros() }
    else { mostrarNotificacion('Error al purgar usuario.', 'error') }
  }

  // ─── CÁLCULOS FINANCIEROS Y GRÁFICAS ───
  const totalFacturadoNube = ventasNubeHoy.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0)
  const capitalEnInventario = listaProductos.reduce((acc, p) => acc + ((parseFloat(p.precio_costo) || 0) * (p.stock_actual || 0)), 0)
  const gananciaProyectadaInventario = listaProductos.reduce((acc, p) => acc + (((parseFloat(p.precio_venta) || 0) - (parseFloat(p.precio_costo) || 0)) * (p.stock_actual || 0)), 0)
  const ticketPromedio = ventasNubeHoy.length > 0 ? totalFacturadoNube / ventasNubeHoy.length : 0

  const ventasSemanaHistorico = [0, 0, 0, 0, 0, 0, totalFacturadoNube]
  const maxValorVenta = Math.max(...ventasSemanaHistorico, 100)
  const puntosGrafica = ventasSemanaHistorico.map((monto, index) => ({ x: index * 100, y: 150 - (monto / maxValorVenta) * 110 }))
  const lineaPath = "M " + puntosGrafica.map(p => `${p.x},${p.y}`).join(" L ")
  const areaPath = `${lineaPath} L 600,150 L 0,150 Z`

  const topRentables = [...listaProductos]
    .filter(p => (parseFloat(p.precio_venta) > 0) && (parseFloat(p.precio_costo) > 0))
    .sort((a, b) => {
      const margenA = ((a.precio_venta - a.precio_costo) / a.precio_venta) * 100
      const margenB = ((b.precio_venta - b.precio_costo) / b.precio_venta) * 100
      return margenB - margenA
    }).slice(0, 3)

  const rendimientoOperadores = listaUsuarios.map(u => {
    const ventasDelUsuario = ventasNubeHoy.filter(v => v.vendedor_id === u.id)
    const totalRecaudado = ventasDelUsuario.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0)
    return { ...u, totalVentas: totalRecaudado, cantidadVentas: ventasDelUsuario.length }
  }).sort((a, b) => b.totalVentas - a.totalVentas)

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-t-indigo-500 rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-slate-950 text-white flex relative selection:bg-indigo-500/30 font-sans text-xs">
      
      {/* TOAST NOTIFICACIONES */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border bg-slate-900/95 text-emerald-400 border-emerald-500/20 shadow-2xl">
          <p className="text-xs font-bold">{toast.message}</p>
        </div>
      )}

      {/* ─── SIDEBAR PREMIUM ─── */}
      <div className="w-64 bg-slate-900/40 border-r border-white/5 p-6 flex flex-col justify-between hidden md:flex backdrop-blur-xl">
        <div className="space-y-8">
          <div className="text-center py-2 border-b border-white/5">
            <h1 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">EMPORIO</h1>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mt-1">Modo Administrador</p>
          </div>
          <nav className="space-y-1.5">
            <button onClick={() => setActiveTab('resumen')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'resumen' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>📊 Consola Financiera</button>
            <button onClick={() => setActiveTab('inventario')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'inventario' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>📦 Almacén Central</button>
            {userRole === 'admin' && <button onClick={() => setActiveTab('personal')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'personal' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>👥 Personal Online</button>}
            
            {/* 🔥 NUEVO NOMBRE DE PESTAÑA */}
            <button onClick={() => setActiveTab('historial')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold uppercase tracking-wider transition-all ${activeTab === 'historial' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>🧾 Historial y Caseros</button>
          </nav>
        </div>
        <div className="pt-4 border-t border-white/5 space-y-3">
          <div className="text-left px-2">
            <p className="text-[11px] text-slate-300 font-bold truncate">{user?.email}</p>
            <p className="text-[9px] uppercase font-black text-amber-400 mt-0.5">Rango: {userRole}</p>
          </div>
          <button onClick={handleLogout} className="w-full py-2.5 bg-red-950/20 text-red-400 font-bold uppercase rounded-xl border border-red-500/10">Desconectar</button>
        </div>
      </div>

      {/* ─── CONTENIDO DASHBOARD ─── */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        
        {/* TAB 1: CONSOLA FINANCIERA REAL */}
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-fadeIn max-w-[1400px] mx-auto">
            <div>
              <h2 className="text-base font-black uppercase tracking-widest text-slate-200">Consola de Rendimiento Real</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Métricas dinámicas vinculadas directamente a la base de datos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Facturación Nube (Hoy)</p>
                <h3 className="text-2xl font-black font-mono mt-1">S/ {totalFacturadoNube.toFixed(2)}</h3>
                <p className="text-[10px] text-slate-500 mt-2">{ventasNubeHoy.length} boletas reales hoy</p>
              </div>
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Inversión Almacén</p>
                <h3 className="text-2xl font-black font-mono mt-1">S/ {capitalEnInventario.toFixed(2)}</h3>
                <p className="text-[10px] text-slate-500 mt-2">Costo total de mercadería</p>
              </div>
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Utilidad Estimada</p>
                <h3 className="text-2xl font-black font-mono mt-1">S/ {gananciaProyectadaInventario.toFixed(2)}</h3>
                <p className="text-[10px] text-slate-500 mt-2">Margen bruto en inventario</p>
              </div>
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                <p className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Ticket Promedio</p>
                <h3 className="text-2xl font-black font-mono mt-1">S/ {ticketPromedio.toFixed(2)}</h3>
                <p className="text-[10px] text-slate-500 mt-2">Gasto promedio por compra</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-2xl p-5 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4">Curva Real de Inyección de Caja</h3>
                <div className="w-full h-40 relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 600 150" preserveAspectRatio="none">
                    <defs><linearGradient id="gradientGlow" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" /></linearGradient></defs>
                    <line x1="0" y1="150" x2="600" y2="150" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="1.5" />
                    <path d={areaPath} fill="url(#gradientGlow)" className="transition-all" />
                    <path d={lineaPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                    {puntosGrafica.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#1e293b" stroke="#818cf8" strokeWidth="2" className="hover:r-6 hover:fill-indigo-400 transition-all cursor-crosshair" />
                    ))}
                  </svg>
                  <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-500 uppercase">
                    <span>Mon</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span><span className="text-indigo-400 font-black">Hoy (Real)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-white/5 pb-2 mb-3">Últimas Ventas Oficiales</h3>
                <div className="space-y-2 overflow-y-auto max-h-[160px] flex-1 custom-scrollbar">
                  {ventasNubeHoy.length === 0 ? <p className="text-center italic text-slate-600 pt-10">Sin boletas emitidas hoy.</p> : (
                    ventasNubeHoy.slice(0, 4).map((v, idx) => (
                      <div key={idx} className="p-2 bg-slate-950 rounded-xl border border-white/5 flex justify-between items-center text-[11px]">
                        <div><p className="font-bold text-slate-300 truncate uppercase">{v.cliente}</p><p className="text-[9px] text-slate-500">DNI: {v.dni}</p></div>
                        <span className="font-mono font-black text-emerald-400">S/ {parseFloat(v.total).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 shadow-xl flex flex-col h-80">
                <div className="flex justify-between items-end border-b border-white/5 pb-3 mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">Rendimiento por Operador (En Vivo)</h3>
                  <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span></span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar pr-2">
                  {rendimientoOperadores.length === 0 ? <p className="text-center italic text-slate-600 pt-10 text-xs">Sin registros de operadores.</p> : (
                    rendimientoOperadores.map((op, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${op.is_online ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`}></div>
                          <div>
                            <p className="font-bold text-slate-200 text-xs uppercase">{op.nombre}</p>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">{op.cantidadVentas} boletas emitidas hoy</p>
                          </div>
                        </div>
                        <span className="font-black font-mono text-cyan-400 text-sm">S/ {op.totalVentas.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-8 shadow-xl flex flex-col h-80">
                <h3 className="text-sm font-black uppercase tracking-widest text-red-400 border-b border-white/5 pb-3 mb-4">⚠️ Radar de Alerta: Quiebre de Stock</h3>
                <div className="space-y-3 overflow-y-auto flex-1 custom-scrollbar pr-2">
                  {listaProductos.filter(p => p.stock_actual <= 5).map((p, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-red-500/10 flex justify-between items-center">
                      <span className="truncate font-bold text-slate-300 uppercase">{p.nombre}</span>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black ${p.stock_actual <= 0 ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'}`}>{p.stock_actual} u</span>
                    </div>
                  ))}
                  {listaProductos.filter(p => p.stock_actual <= 5).length === 0 && <p className="text-xs text-slate-500 italic py-10 text-center">¡Excelente! Todos los productos tienen stock saludable.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTARIO (CRUD) */}
        {activeTab === 'inventario' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn max-w-[1600px] mx-auto">
            {userRole === 'admin' && (
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 h-fit shadow-xl">
                <h2 className="text-xs font-black uppercase tracking-widest text-indigo-400 border-b border-white/5 pb-2 mb-4">Nuevo Artículo</h2>
                <form onSubmit={handleAddProducto} className="space-y-3">
                  <div><label className="block text-[10px] uppercase text-slate-500 mb-1">Descripción del Ítem</label><input type="text" value={nombreProd} onChange={(e) => setNombreProd(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-xs focus:outline-none" required /></div>
                  <div><label className="block text-[10px] uppercase text-slate-500 mb-1">Código (Blanco = Auto-generar)</label><input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="EAN-8 automático" className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs font-mono text-white focus:outline-none placeholder:text-slate-700" /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="block text-[10px] uppercase text-slate-500 mb-1">Costo S/</label><input type="number" step="0.01" value={precioCosto} onChange={(e) => setPrecioCosto(e.target.value)} className="w-full px-2 py-2 bg-slate-950 border text-xs" required /></div>
                    <div><label className="block text-[10px] uppercase text-slate-500 mb-1">Venta S/</label><input type="number" step="0.01" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} className="w-full px-2 py-2 bg-slate-950 border text-xs" required /></div>
                    <div><label className="block text-[10px] uppercase text-slate-500 mb-1">Stock Inicial</label><input type="number" value={stockActual} onChange={(e) => setStockActual(e.target.value)} className="w-full px-2 py-2 bg-slate-950 border text-xs" required /></div>
                  </div>
                  <button type="submit" disabled={savingProd} className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-lg">{savingProd ? 'Guardando...' : 'Inyectar a la Base de Datos'}</button>
                </form>
              </div>
            )}
            <div className={`${userRole === 'admin' ? 'xl:col-span-2' : 'xl:col-span-3'} bg-slate-900/40 border border-white/5 rounded-2xl p-5 shadow-xl h-[calc(100vh-80px)] overflow-hidden flex flex-col`}>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-400 uppercase text-[9px] font-black border-b border-white/5"><th className="p-3">Producto</th><th className="p-3">Barras</th><th className="p-3 text-center">Costo</th><th className="p-3 text-center">Venta</th><th className="p-3 text-center">Stock</th>{userRole === 'admin' && <th className="p-3 text-right">Acción</th>}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {listaProductos.map((p, i) => (
                      <tr key={i} className="hover:bg-white/[0.01] group">
                        <td className="p-3 font-bold text-slate-200 uppercase">{p.nombre}</td>
                        <td className="p-3 text-slate-500 font-mono text-[10px]">{p.codigo_barras}</td>
                        <td className="p-3 text-center font-mono text-slate-400">S/ {parseFloat(p.precio_costo || 0).toFixed(2)}</td>
                        <td className="p-3 text-center font-mono font-black text-emerald-400">S/ {parseFloat(p.precio_venta || 0).toFixed(2)}</td>
                        <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded font-bold text-[10px] ${p.stock_actual <= 0 ? 'bg-red-950/50 text-red-400' : 'bg-slate-950 text-emerald-400'}`}>{p.stock_actual} u</span></td>
                        {userRole === 'admin' && (
                          <td className="p-3 text-right opacity-0 group-hover:opacity-100 transition-opacity space-x-1.5">
                            <button onClick={() => { setEditProdTarget(p); setModalEditProdOpen(true); }} className="p-1.5 bg-indigo-900/30 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white">✏️</button>
                            <button onClick={() => handleEliminarProducto(p.id, p.nombre)} className="p-1.5 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-600 hover:text-white">🗑️</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERSONAL ACCESOS (SIN FILTROS - SE VEN TODOS) */}
        {activeTab === 'personal' && userRole === 'admin' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 animate-fadeIn max-w-[1400px] mx-auto">
            <div className="xl:col-span-2 bg-slate-900/40 border border-white/5 rounded-2xl p-5 h-fit shadow-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-indigo-400 border-b border-white/5 pb-2 mb-4">Alta de Personal</h2>
              <form onSubmit={handleAddPersonal} className="space-y-3">
                <div><label className="block text-[10px] text-slate-500 mb-1">Nombre Operador</label><input type="text" value={empNombre} onChange={(e) => setEmpNombre(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-xs focus:outline-none" required /></div>
                <div><label className="block text-[10px] text-slate-500 mb-1">Correo de Acceso</label><input type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-xs focus:outline-none" required /></div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Contraseña</label>
                  <div className="relative">
                    <input type={showEmpPassword ? 'text' : 'password'} value={empPassword} onChange={(e) => setEmpPassword(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-xs focus:outline-none" required />
                    <button type="button" onClick={() => setShowEmpPassword(!showEmpPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">👁️</button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Jerarquía</label>
                  <select value={empRol} onChange={(e) => setEmpRol(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border text-slate-300 rounded-xl">
                    <option value="trabajador">Vendedor / Cajero</option>
                    <option value="supervisor">Supervisor de Planta</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={handleLimpiarFormularioPersonal} className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-[10px] uppercase rounded-xl">Limpiar</button>
                  <button type="submit" disabled={savingEmp} className="flex-1 py-2.5 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg">{savingEmp ? 'Procesando...' : 'Crear Acceso'}</button>
                </div>
              </form>
            </div>

            <div className="xl:col-span-3 bg-slate-900/40 border border-white/5 rounded-2xl p-5 shadow-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-200 border-b border-white/5 pb-2 mb-4">Plantilla General (Todos los Rangos)</h2>
              <div className="space-y-2 overflow-y-auto max-h-[440px] custom-scrollbar">
                {/* 🔥 CORRECCIÓN: Filtro removido. Se muestran absolutamente todos los usuarios */}
                {listaUsuarios.map((u, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-slate-950/60 rounded-xl border border-white/5 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className={`w-2 h-2 rounded-full ${u.is_online ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`}></div>
                        <p className="font-black text-slate-200 text-xs uppercase truncate">{u.nombre}</p>
                      </div>
                      <p className="text-slate-500 text-[9px] font-mono pl-4">{u.correo_interno}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={u.rol} onChange={(e) => handleUpdateRole(u.id, e.target.value)} className={`px-2 py-1.5 bg-slate-900 border rounded-lg text-[9px] font-black uppercase tracking-wider focus:outline-none ${u.rol === 'admin' ? 'text-indigo-400 border-indigo-500/30' : u.rol === 'supervisor' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}`}>
                        <option value="trabajador">Trabajador</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={() => openResetModal(u.id, u.nombre)} className="p-2 bg-slate-900 text-slate-400 hover:text-indigo-400 rounded-lg border border-white/5">🔑</button>
                      <button onClick={() => openDeleteModal(u.id, u.nombre)} className="p-2 bg-slate-900 text-slate-400 hover:text-red-400 rounded-lg border border-white/5">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GESTOR DE COMPROBANTES Y CASEROS (LA NUEVA FUNCIÓN ESTRELLA) */}
        {activeTab === 'historial' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fadeIn max-w-[1500px] mx-auto h-[calc(100vh-100px)]">
            
            {/* PANEL DE CASEROS */}
            <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col shadow-xl">
              <div className="flex justify-between items-end border-b border-white/5 pb-3 mb-3">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">Directorio de Caseros</h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Cartera de Clientes Frecuentes</p>
                </div>
                <span className="px-2 py-0.5 bg-emerald-950/30 text-emerald-400 text-[10px] font-black rounded-md">{listaCaseros.length} Caseros</span>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                {listaCaseros.length === 0 ? <p className="text-center italic text-slate-600 pt-10 text-xs">Aún no tienes caseros registrados.</p> : (
                  listaCaseros.map((c, i) => (
                    <div key={i} className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between items-center text-[11px]">
                      <div>
                        <p className="font-black text-slate-200 uppercase">{c.nombre}</p>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">DNI/RUC: {c.dni} • {c.direccion}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-indigo-900/30 text-indigo-400 font-black font-mono text-[10px] rounded border border-indigo-500/20">ID: {c.id}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 🔥 NUEVO PANEL: GESTOR HISTÓRICO DE COMPROBANTES (REEMPLAZA A AUDITORÍA) */}
            <div className="lg:col-span-3 bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex flex-col shadow-xl">
              <div className="border-b border-white/5 pb-3 mb-3 flex justify-between items-end">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-amber-400">Historial de Transacciones (Comprobantes)</h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Registro global de todas las ventas emitidas</p>
                </div>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar DNI o Cliente..." 
                  value={buscarTicket} 
                  onChange={(e) => setBuscarTicket(e.target.value)} 
                  className="w-48 px-3 py-1.5 bg-slate-950 border border-white/5 rounded-lg text-white text-[10px] focus:outline-none" 
                />
              </div>
              <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                {historialVentas.length === 0 ? <p className="text-center text-slate-600 italic pt-10 text-xs">Aún no hay comprobantes emitidos en el sistema.</p> : (
                  historialVentas
                    .filter(v => v.cliente.toLowerCase().includes(buscarTicket.toLowerCase()) || v.dni.includes(buscarTicket))
                    .map((ticket, i) => {
                      // Extraemos los productos directamente del JSON para mostrarlos
                      const itemsDetalle = ticket.ticket_json?.items || []
                      const metodoPago = ticket.ticket_json?.metodo_pago || 'EFECTIVO'

                      return (
                        <div key={i} className="p-4 bg-slate-950/80 rounded-xl border border-white/5 flex flex-col gap-3">
                          <div className="flex justify-between items-start border-b border-white/5 pb-2">
                            <div>
                              <p className="text-xs font-black text-slate-200 uppercase">{ticket.cliente}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">DNI: {ticket.dni} • Emitido: {new Date(ticket.creado_en || ticket.created_at).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-black text-emerald-400 text-sm block">S/ {parseFloat(ticket.total).toFixed(2)}</span>
                              <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 text-[8px] font-black uppercase rounded">{metodoPago}</span>
                            </div>
                          </div>
                          
                          {/* Desglose de los productos dentro del ticket */}
                          <div className="flex flex-wrap gap-2">
                            {itemsDetalle.map((it, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white/5 text-slate-300 text-[9px] rounded font-bold uppercase">
                                {it.cantidad}x {it.nombre}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                  })
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ─── MODALES DE CONTROL ADMIN (CRUD) ─── */}
      {modalEditProdOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl animate-fadeIn">
            <h3 className="text-sm font-black tracking-widest text-indigo-400 uppercase mb-6">Editar Ficha de Almacén</h3>
            <form onSubmit={handleGuardarEdicionProducto} className="space-y-3">
              <div><label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Descripción del Producto</label><input type="text" value={editProdTarget.nombre} onChange={(e) => setEditProdTarget({...editProdTarget, nombre: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-xs focus:outline-none" required /></div>
              <div><label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Cód. Barras</label><input type="text" value={editProdTarget.codigo_barras} onChange={(e) => setEditProdTarget({...editProdTarget, codigo_barras: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs font-mono text-white focus:outline-none" required /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Costo S/</label><input type="number" step="0.01" value={editProdTarget.precio_costo} onChange={(e) => setEditProdTarget({...editProdTarget, precio_costo: e.target.value})} className="w-full px-2 py-2 bg-slate-950 border rounded text-xs font-mono" required /></div>
                <div><label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Venta S/</label><input type="number" step="0.01" value={editProdTarget.precio_venta} onChange={(e) => setEditProdTarget({...editProdTarget, precio_venta: e.target.value})} className="w-full px-2 py-2 bg-slate-950 border rounded text-xs font-mono" required /></div>
                <div><label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Stock Real</label><input type="number" value={editProdTarget.stock_actual} onChange={(e) => setEditProdTarget({...editProdTarget, stock_actual: e.target.value})} className="w-full px-2 py-2 bg-slate-950 border rounded text-xs font-mono" required /></div>
              </div>
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setModalEditProdOpen(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold uppercase rounded-lg text-[10px]">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white font-black uppercase rounded-lg text-[10px] shadow-lg">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalResetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-indigo-500/20 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Sobreescribir Acceso</h3>
            <p className="text-[10px] text-slate-400 mb-4">Nueva clave para: <strong className="text-white uppercase">{resetUser.nombre}</strong></p>
            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <input type="password" value={nuevaClaveInput} onChange={(e) => setNuevaClaveInput(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500" required />
              <div className="flex gap-2"><button type="button" onClick={() => setModalResetOpen(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-[10px] uppercase">Cancelar</button><button type="submit" disabled={resetSaving} className="flex-1 py-2 bg-indigo-600 text-white font-black text-[10px] uppercase">{resetSaving ? 'Guardando...' : 'Reescribir'}</button></div>
            </form>
          </div>
        </div>
      )}

      {modalDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/20 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-10 h-10 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto font-bold mb-3">⚠️</div>
            <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Revocar Credencial</h3>
            <p className="text-[10px] text-slate-300 mt-1 mb-5 leading-relaxed">¿Eliminar por completo a <strong className="text-white">{deleteTarget.nombre}</strong> de la organización y purgar su acceso?</p>
            <div className="flex gap-2"><button type="button" onClick={() => setModalDeleteOpen(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 font-bold text-[10px] uppercase">Regresar</button><button type="button" onClick={handleConfirmDeleteUser} disabled={deleteSaving} className="flex-1 py-2 bg-red-600 text-white font-black text-[10px] uppercase">{deleteSaving ? 'Revocando...' : 'Eliminar Operador'}</button></div>
          </div>
        </div>
      )}

    </div>
  )
}