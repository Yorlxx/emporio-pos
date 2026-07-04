'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function TiendaCliente() {
  const [activeTab, setActiveTab] = useState('tienda') // 'tienda' o 'rastreo'

  // Estados Tienda
  const [productos, setProductos] = useState([])
  const [listaTrabajadores, setListaTrabajadores] = useState([])
  const [buscar, setBuscar] = useState('')
  const [carrito, setCarrito] = useState([])
  const [enviando, setEnviando] = useState(false)
  
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState('recojo') 
  const [horaRecojo, setHoraRecojo] = useState('12:00')
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo') 

  const [pedidoExitoso, setPedidoExitoso] = useState(false)
  const [ticketNumero, setTicketNumero] = useState(null)
  
  // Estados Rastreador
  const [busquedaDni, setBusquedaDni] = useState('')
  const [misPedidosEncontrados, setMisPedidosEncontrados] = useState([])
  const [buscandoPedidos, setBuscandoPedidos] = useState(false)
  const [busquedaRealizada, setBusquedaRealizada] = useState(false)

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const mostrarNotificacion = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000)
  }

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      const { data: prods } = await supabase.from('productos').select('id, nombre, codigo_barras, precio_venta, stock_actual').gt('stock_actual', 0)
      if (prods) setProductos(prods)
      const { data: workers } = await supabase.from('perfiles').select('id, nombre').eq('rol', 'trabajador').eq('is_online', true)
      if (workers) { setListaTrabajadores(workers); if (workers.length > 0) setTrabajadorSeleccionado(workers[0].id) }
    }
    cargarDatosIniciales()
  }, [])

  const agregarAlCarrito = (prod) => {
    const existe = carrito.find(item => item.id === prod.id)
    const esPorPeso = prod.nombre.toLowerCase().includes('pollo') || prod.nombre.toLowerCase().includes('carne')
    if (existe) {
      if (existe.cantidad >= prod.stock_actual) return mostrarNotificacion('Existencias agotadas.', 'error')
      setCarrito(carrito.map(item => item.id === prod.id ? { ...item, cantidad: esPorPeso ? item.cantidad + 0.100 : item.cantidad + 1 } : item))
    } else { setCarrito([...carrito, { ...prod, cantidad: esPorPeso ? 1.000 : 1, esPorPeso }]) }
    mostrarNotificacion(`${prod.nombre} sumado.`)
  }

  const eliminarDelCarrito = (id) => setCarrito(carrito.filter(item => item.id !== id))
  const total = carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0)

  const handleEnviarPedidoOnline = async (e) => {
    e.preventDefault()
    if (carrito.length === 0) return mostrarNotificacion('Carrito vacío.', 'error')
    if (!nombre.trim() || !dni.trim()) return mostrarNotificacion('Rellene sus datos.', 'error')
    if (!trabajadorSeleccionado) return mostrarNotificacion('Seleccione un vendedor activo.', 'error')
    if (tipoEntrega === 'delivery' && total < 50) return mostrarNotificacion('Delivery requiere compra mayor a S/ 50.00.', 'error')

    setEnviando(true)
    const estructuraItems = carrito.map(item => ({ producto_id: item.id, nombre: item.nombre, cantidad: item.cantidad, precio_unitario: item.precio_venta, unidad_medida: item.esPorPeso ? 'KG' : 'UND' }))

    const { error } = await supabase.from('pedidos_virtuales').insert([{ cliente_nombre: nombre, cliente_dni: dni, items_pedidos: estructuraItems, total: total, tipo_entrega: tipoEntrega, hora_recojo: tipoEntrega === 'recojo' ? horaRecojo : null, vendedor_asignado_id: trabajadorSeleccionado, metodo_pago: metodoPago, estado: 'pendiente' }])
    
    setEnviando(false)
    if (error) { mostrarNotificacion(`Error: ${error.message}`, 'error') } 
    else { setTicketNumero(Math.floor(1000 + Math.random() * 9000)); setPedidoExitoso(true); setCarrito([]); setNombre('') }
  }

  const buscarMisPedidosVirtuales = async (e) => {
    e.preventDefault()
    if (!busquedaDni.trim()) return
    setBuscandoPedidos(true); setBusquedaRealizada(false)

    const { data, error } = await supabase
      .from('pedidos_virtuales')
      .select('id, created_at, total, tipo_entrega, metodo_pago, estado, items_pedidos')
      .eq('cliente_dni', busquedaDni)

    setBuscandoPedidos(false)
    if (!error && data) {
      setMisPedidosEncontrados(data)
      setBusquedaRealizada(true)
    }
  }

  if (pedidoExitoso) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/20 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto">✓</div>
          <div className="space-y-2"><h2 className="text-xl font-black text-white">¡PEDIDO ENVIADO!</h2><p className="text-xs text-slate-400">Orden enviada. Prepara tu método de pago ({metodoPago.toUpperCase()}) para cuando el cajero lo solicite.</p></div>
          <div className="bg-slate-950 p-4 rounded-xl border border-white/5"><p className="text-[10px] font-bold text-slate-500 tracking-wider">Número de Orden</p><p className="text-3xl font-mono font-black text-emerald-400 mt-1"># {ticketNumero}</p></div>
          <button onClick={() => { setPedidoExitoso(false); setActiveTab('rastreo'); setBusquedaDni(dni); setDni('') }} className="w-full py-3 bg-slate-800 text-xs font-bold uppercase rounded-xl">Rastrear mi pedido</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-6">
      {toast.show && <div className="fixed top-6 right-6 z-50 px-5 py-3.5 rounded-xl border bg-slate-900/90 text-emerald-400 border-emerald-500/20"><p className="text-xs font-semibold">{toast.message}</p></div>}

      {/* HEADER NAVEGACIÓN CLIENTE */}
      <div className="w-full max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">EMPORIO - TIENDA VIRTUAL</h1>
          <p className="text-xs text-slate-500">Realiza tu pedido y evita las colas en tienda.</p>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5">
          <button onClick={() => setActiveTab('tienda')} className={`px-5 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'tienda' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>🛍️ Catálogo</button>
          <button onClick={() => setActiveTab('rastreo')} className={`px-5 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeTab === 'rastreo' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>🔍 Mis Pedidos</button>
        </div>
      </div>

      {activeTab === 'tienda' ? (
        // VISTA 1: CATÁLOGO Y COMPRAS
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start animate-fadeIn">
          
          <div className="lg:col-span-2 space-y-4 bg-slate-900/40 p-6 rounded-2xl border border-white/5">
            <input type="text" placeholder="🔍 Buscar producto en tienda..." value={buscar} onChange={(e) => setBuscar(e.target.value)} className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-xl text-sm focus:outline-none text-white" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
              {productos.filter(p => p.nombre.toLowerCase().includes(buscar.toLowerCase())).map((p, idx) => (
                <div key={idx} className="p-4 bg-slate-950/50 border border-white/5 rounded-xl flex justify-between items-center">
                  <div><p className="font-semibold text-sm">{p.nombre}</p><p className="text-xs font-bold text-indigo-400 mt-1">S/ {p.precio_venta.toFixed(2)}</p></div>
                  <button onClick={() => agregarAlCarrito(p)} className="px-3 py-1.5 bg-indigo-600/10 text-indigo-400 font-bold rounded-lg text-xs">+ Añadir</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-white/5 pb-2">Tu Cesta Virtual</h2>
              <div className="space-y-2 mt-3 max-h-[140px] overflow-y-auto pr-1">
                {carrito.length === 0 ? <p className="text-xs text-slate-600 italic text-center py-6">Tu bolsa está vacía.</p> : (
                  carrito.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-950 rounded-lg border border-white/5">
                      <span className="truncate max-w-[140px] font-medium">{item.nombre} (x{item.cantidad})</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">S/ {(item.precio_venta * item.cantidad).toFixed(2)}</span>
                        <button type="button" onClick={() => eliminarDelCarrito(item.id)} className="text-red-500 hover:text-red-400 font-bold">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleEnviarPedidoOnline} className="space-y-3 pt-2 border-t border-white/5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Detalles de Recepción</h2>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] text-slate-400 uppercase mb-1">Nombre</label><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white" required /></div>
                <div><label className="block text-[10px] text-slate-400 uppercase mb-1">DNI</label><input type="text" value={dni} onChange={(e) => setDni(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs font-mono text-white" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Modalidad</label>
                  <select value={tipoEntrega} onChange={(e) => setTipoEntrega(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs">
                    <option value="recojo">🏬 Recojo tienda</option>
                    <option value="delivery">🛵 Delivery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Cajero:</label>
                  <select value={trabajadorSeleccionado} onChange={(e) => setTrabajadorSeleccionado(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-indigo-400 font-bold">
                    {listaTrabajadores.length === 0 ? <option value="">Sin cajeros online</option> : listaTrabajadores.map((t, i) => <option key={i} value={t.id}>👤 {t.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="block text-[10px] text-slate-400 uppercase mb-0.5">Método de Pago a usar en caja</label>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none">
                  <option value="efectivo">💵 Efectivo Físico</option>
                  <option value="yape">📱 Yape / Plin</option>
                  <option value="transferencia">🏦 Transferencia Bancaria</option>
                </select>
              </div>

              {tipoEntrega === 'recojo' ? (
                <div className="animate-fadeIn"><label className="block text-[10px] text-slate-400 uppercase mb-1">Hora de Recojo</label><input type="time" value={horaRecojo} onChange={(e) => setHoraRecojo(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white font-mono" required /></div>
              ) : (
                <div className="p-3 bg-amber-950/20 border border-amber-500/10 rounded-xl text-[11px] text-amber-400 animate-fadeIn">💡 Delivery solo para compras mayores a S/ 50.00.</div>
              )}

              <div className="flex justify-between items-baseline pt-3 border-t border-white/5">
                <span className="text-xs font-bold text-slate-400 uppercase">Monto</span>
                <span className="text-2xl font-black font-mono text-indigo-400">S/ {total.toFixed(2)}</span>
              </div>
              <button type="submit" disabled={enviando || carrito.length === 0} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white font-black text-xs tracking-widest uppercase rounded-xl transition-all shadow-lg">
                {enviando ? 'Verificando...' : '🚀 Despachar Orden Virtual'}
              </button>
            </form>
          </div>
        </div>

      ) : (

        // VISTA 2: RASTREADOR DE PEDIDOS
        <div className="w-full max-w-2xl mx-auto bg-slate-900/40 border border-white/5 rounded-2xl p-8 animate-fadeIn mt-4">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-white mb-2">Rastreador de Órdenes</h2>
            <p className="text-xs text-slate-400">Ingresa tu número de DNI para consultar el estado de tus compras virtuales.</p>
          </div>

          <form onSubmit={buscarMisPedidosVirtuales} className="flex gap-3 max-w-md mx-auto mb-8">
            <input type="text" placeholder="Escribe tu DNI exacto..." value={busquedaDni} onChange={(e) => setBusquedaDni(e.target.value)} className="flex-1 px-4 py-3 bg-slate-950 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-indigo-500 font-mono" required />
            <button type="submit" disabled={buscandoPedidos} className="px-6 py-3 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl">
              {buscandoPedidos ? 'Buscando...' : 'Consultar'}
            </button>
          </form>

          {busquedaRealizada && (
            <div className="space-y-4">
              {misPedidosEncontrados.length === 0 ? (
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-6 text-center space-y-2">
                  <div className="text-3xl mb-2">🎉</div>
                  <h3 className="text-emerald-400 font-bold text-sm">¡No hay pedidos pendientes!</h3>
                  <p className="text-xs text-slate-400">Si enviaste un pedido recientemente y no aparece aquí, significa que nuestro cajero **ya lo procesó, facturó y está despachado**.<br/><br/>(Por razones de ahorro de espacio en nuestros servidores, las órdenes se eliminan de esta bandeja inmediatamente después de ser cobradas).</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Órdenes en proceso ({misPedidosEncontrados.length}):</h3>
                  {misPedidosEncontrados.map((pedido, i) => (
                    <div key={i} className="bg-slate-950 border border-white/5 rounded-xl p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase rounded-bl-xl">⏳ En Cola de Caja</div>
                      <div className="flex justify-between items-end mb-4 pt-2">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1 font-mono">ID Registro: {pedido.id.split('-')[0]}</p>
                          <p className="text-lg font-black text-indigo-400">S/ {pedido.total.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Pago: {pedido.metodo_pago}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Vía: {pedido.tipo_entrega}</p>
                        </div>
                      </div>
                      <div className="border-t border-white/5 pt-3 space-y-1">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Detalle de tu cesta:</p>
                        {pedido.items_pedidos.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-300">
                            <span>• {it.nombre}</span><span className="font-mono text-slate-500">x{it.cantidad}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}