'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Ventas() {
  const router = useRouter()
  const inputBusquedaRef = useRef(null)

  // ─── ESTADOS GLOBALES ───
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [buscar, setBuscar] = useState('')
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [procesandoCobro, setProcesandoCobro] = useState(false)
  const [tipoVenta, setTipoVenta] = useState('al_paso') 
  const [metodoPagoVenta, setMetodoPagoVenta] = useState('efectivo') 

  const [pedidosOnline, setPedidosOnline] = useState([])
  const [idPedidoVirtualActivo, setIdPedidoVirtualActivo] = useState(null) 

  const [modalClienteOpen, setModalClienteOpen] = useState(false)
  const [clienteDni, setClienteDni] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDireccion, setClienteDireccion] = useState('')

  const [modalCaserosOpen, setModalCaserosOpen] = useState(false)
  const [listaCaseros, setListaCaseros] = useState([])
  const [buscarCasero, setBuscarCasero] = useState('')
  const [registrarComoCasero, setRegistrarComoCasero] = useState(false)

  // ─── GESTIÓN DE CAJA Y EDICIÓN ───
  const [ventasNubeHoy, setVentasNubeHoy] = useState([])
  const [modalCierreCajaOpen, setModalCierreCajaOpen] = useState(false)
  const [modalEdicionProductoOpen, setModalEdicionProductoOpen] = useState(false)
  const [productoAEditar, setProductoAEditar] = useState({ id: null, nombre: '', precio_venta: 0, stock_actual: 0 })
  const [alertasCriticas, setAlertasCriticas] = useState([])

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [modalBoletaOpen, setModalBoletaOpen] = useState(false)
  const [boletaData, setBoletaData] = useState(null)

  // ─── FUNCIONES DE CARGA ───
  const mostrarNotificacion = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000)
  }

  const buscarProductos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, codigo_barras, precio_costo, precio_venta, stock_actual')
      .order('nombre', { ascending: true })
    if (!error && data) {
      setProductos(data)
      const agotados = data.filter(p => p.stock_actual <= 0)
      if (agotados.length > 0) {
        setAlertasCriticas(prev => [...prev.filter(a => !a.includes('agotado')), `⚠️ Hay ${agotados.length} producto(s) totalmente agotado(s).`])
      } else {
        setAlertasCriticas(prev => prev.filter(a => !a.includes('agotado')))
      }
    }
  }

  const cargarPedidosVirtualesEnCola = async (vendedorId) => {
    if (!vendedorId) return
    const { data, error } = await supabase
      .from('pedidos_virtuales')
      .select('id, created_at, cliente_nombre, cliente_dni, items_pedidos, total, tipo_entrega, hora_recojo, metodo_pago')
      .eq('vendedor_asignado_id', vendedorId)
      .eq('estado', 'pendiente')
      
    if (!error && data) {
      setPedidosOnline(data)
      const ahora = new Date()
      const retrasados = data.filter(p => (ahora - new Date(p.created_at)) > 15 * 60 * 1000)
      if (retrasados.length > 0) {
        setAlertasCriticas(prev => [...prev.filter(a => !a.includes('retraso')), `🚨 Tienes ${retrasados.length} orden(es) web con más de 15 minutos de retraso.`])
      } else {
        setAlertasCriticas(prev => prev.filter(a => !a.includes('retraso')))
      }
    }
  }

  const cargarListaCaseros = async () => {
    const { data, error } = await supabase
      .from('clientes_frecuentes')
      .select('id, nombre, dni, direccion')
      .order('nombre', { ascending: true })
    if (!error && data) setListaCaseros(data)
  }

  const cargarVentasNubeHoy = async (vendedorId) => {
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('ventas_nube')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .gte('creado_en', `${hoy}T00:00:00Z`)
    if (data) setVentasNubeHoy(data)
  }

  // ─── EFECTOS ───
  useEffect(() => {
    const checkWorker = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/')
      
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('id, nombre, correo_interno, rol')
        .eq('id', session.user.id)
        .single()

      if (perfil?.rol === 'trabajador' || perfil?.rol === 'admin') {
        setUser(perfil)
        setLoading(false)
        await supabase.from('perfiles').update({ is_online: true }).eq('id', perfil.id)
        
        cargarPedidosVirtualesEnCola(perfil.id)
        cargarVentasNubeHoy(perfil.id)
      } else {
        await supabase.auth.signOut()
        router.push('/')
      }
    }
    checkWorker()
  }, [router])

  useEffect(() => {
    if (user) {
      buscarProductos()
      const intervalId = setInterval(() => {
        cargarPedidosVirtualesEnCola(user.id)
        cargarVentasNubeHoy(user.id)
      }, 10000)
      return () => clearInterval(intervalId)
    }
  }, [user])

  useEffect(() => { if (!loading && inputBusquedaRef.current) inputBusquedaRef.current.focus() }, [loading])
  useEffect(() => { if (modalClienteOpen) cargarListaCaseros() }, [modalClienteOpen])

  useEffect(() => {
    const docFiltro = clienteDni.trim()
    if (docFiltro.length >= 4 && listaCaseros.length > 0) {
      const match = listaCaseros.find(c => c.id.toString() === docFiltro || c.dni === docFiltro)
      if (match) {
        setClienteNombre(match.nombre)
        setClienteDireccion(match.direccion)
      }
    }
  }, [clienteDni, listaCaseros])

  const handleCerrarSesionSeguro = async () => {
    if (user) await supabase.from('perfiles').update({ is_online: false }).eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/')
  }

  const guardarEdicionRapida = async (e) => {
    e.preventDefault()
    await supabase.from('productos').update({ precio_venta: parseFloat(productoAEditar.precio_venta), stock_actual: parseFloat(productoAEditar.stock_actual) }).eq('id', productoAEditar.id)
    try {
      await supabase.from('alertas_sistema').insert([{ emisor_email: 'SISTEMA_AUDITORIA', mensaje: `El cajero ${user.nombre} modificó ${productoAEditar.nombre}. Precio: S/${productoAEditar.precio_venta} | Stock: ${productoAEditar.stock_actual}` }])
    } catch(err) {}
    mostrarNotificacion(`Producto ${productoAEditar.nombre} actualizado al instante.`)
    setModalEdicionProductoOpen(false)
    buscarProductos()
  }

  const cargarPedidoVirtualACaja = (pedido) => {
    const itemsAdaptados = pedido.items_pedidos.map(it => {
      const original = productos.find(p => p.id === it.producto_id) || {}
      return { id: it.producto_id, nombre: it.nombre, codigo_barras: original.codigo_barras || '000000', precio_costo: original.precio_costo || 0, precio_venta: it.precio_unitario, stock_actual: original.stock_actual || 99, cantidad: it.cantidad, esPorPeso: it.unidad_medida === 'KG' }
    })
    const metodoSeguro = pedido.metodo_pago ? pedido.metodo_pago.toUpperCase() : 'EFECTIVO'
    setCarrito(itemsAdaptados)
    setClienteDni(pedido.cliente_dni)
    setClienteNombre(pedido.cliente_nombre)
    setClienteDireccion(pedido.tipo_entrega === 'delivery' ? `DELIVERY [PAGO: ${metodoSeguro}]` : `RECOJO: ${pedido.hora_recojo} [PAGO: ${metodoSeguro}]`)
    setMetodoPagoVenta(metodoSeguro.toLowerCase()) 
    setIdPedidoVirtualActivo(pedido.id)
    setTipoVenta('oficial')
    mostrarNotificacion(`Pedido web de ${pedido.cliente_nombre} montado en caja.`)
  }

  const limpiarCajaCompleta = () => {
    setCarrito([]); setClienteDni(''); setClienteNombre(''); setClienteDireccion(''); setIdPedidoVirtualActivo(null)
    mostrarNotificacion('Caja limpiada.')
    setTimeout(() => inputBusquedaRef.current?.focus(), 50)
  }

  const agregarAlCarrito = (prod) => {
    const existe = carrito.find(item => item.codigo_barras === prod.codigo_barras)
    const esPorPeso = prod.nombre.toLowerCase().includes('pollo') || prod.nombre.toLowerCase().includes('carne') || prod.nombre.toLowerCase().includes('peso')
    if (existe) {
      if (existe.cantidad >= prod.stock_actual) return mostrarNotificacion('Límite de stock.', 'error')
      setCarrito(carrito.map(item => item.codigo_barras === prod.codigo_barras ? { ...item, cantidad: esPorPeso ? item.cantidad + 0.100 : item.cantidad + 1 } : item))
    } else { setCarrito([...carrito, { ...prod, cantidad: esPorPeso ? 1.000 : 1, esPorPeso }]) }
  }

  const handleKeyDownBusqueda = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); const codigoEscaneado = buscar.trim()
      if (!codigoEscaneado) return
      const productoEncontrado = productos.find(p => p.codigo_barras === codigoEscaneado)
      if (productoEncontrado) { agregarAlCarrito(productoEncontrado); setBuscar('') } 
      else { mostrarNotificacion('Código no registrado.', 'error') }
    }
  }

  const handleCambiarCantidadCarrito = (codigo, valor) => {
    const nuevaCantidad = parseFloat(valor) || 0
    setCarrito(carrito.map(item => item.codigo_barras === codigo ? { ...item, cantidad: nuevaCantidad > item.stock_actual ? item.stock_actual : nuevaCantidad } : item))
  }
  const eliminarDelCarrito = (codigo) => setCarrito(carrito.filter(item => item.codigo_barras !== codigo))

  const total = carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0)
  const igv = total * 0.18; const subtotal = total - igv

  // ─── RENDIMIENTO TOTAL BASADO 100% EN SUPABASE ───
  const granTotalDia = ventasNubeHoy.reduce((acc, v) => acc + parseFloat(v.total), 0)
  const arqueoEfectivo = ventasNubeHoy.filter(v => v.ticket_json?.metodo_pago === 'efectivo').reduce((a,v) => a + parseFloat(v.total), 0)
  const arqueoDigital = granTotalDia - arqueoEfectivo 

  // ─── PROCESADORES DE COBRO UNIFICADOS A LA NUBE ───
  const handleBotonCobrarPrincipal = () => {
    if (carrito.length === 0) return mostrarNotificacion('No hay artículos.', 'error')
    if (tipoVenta === 'oficial') setModalClienteOpen(true) 
    else procesarTransaccionTxtAlPaso()
  }

  const purgarPedidoVirtualAtendido = async () => {
    if (idPedidoVirtualActivo) {
      setPedidosOnline(prev => prev.filter(p => p.id !== idPedidoVirtualActivo))
      await supabase.from('pedidos_virtuales').delete().eq('id', idPedidoVirtualActivo)
      setIdPedidoVirtualActivo(null)
    }
  }

  // 🔥 CORE FIX: Las ventas al paso ahora sí se inyectan a Supabase
  const procesarTransaccionTxtAlPaso = async () => {
    setProcesandoCobro(true)
    const clientePorDefecto = { dni: '00000000', nombre: 'PÚBLICO GENERAL (AL PASO)', direccion: 'S/N - JULIACA' }
    const numOperacionRandom = Math.floor(1000 + Math.random() * 9000)
    const comprobanteFormatoCorrelativo = `T001-${String(numOperacionRandom).padStart(8, '0')}`

    const estructuraJsonItems = { 
      items: carrito.map(item => ({ producto_id: item.id, nombre: item.nombre, cantidad: item.cantidad, precio_cobrado: item.precio_venta, unidad_medida: item.esPorPeso ? 'KG' : 'UND' })), 
      metodo_pago: metodoPagoVenta,
      tipo_comprobante: 'AL PASO',
      id_ticket: comprobanteFormatoCorrelativo
    }
    
    // 1. Guardar venta en la Nube (El admin la verá instantáneamente)
    const { error: errorVenta } = await supabase.from('ventas_nube').insert([{ 
      total: total, vendedor_id: user.id, cliente: clientePorDefecto.nombre, dni: clientePorDefecto.dni, ticket_json: estructuraJsonItems 
    }])
    if (errorVenta) { setProcesandoCobro(false); return mostrarNotificacion(`Error: ${errorVenta.message}`, 'error') }

    // 2. Descontar Stock Oficialmente
    for (const item of carrito) {
      await supabase.from('productos').update({ stock_actual: item.stock_actual - item.cantidad }).eq('id', item.id)
    }

    await purgarPedidoVirtualAtendido() 

    setBoletaData({ numOperacion: comprobanteFormatoCorrelativo, fecha: new Date().toLocaleString(), cajero: user.nombre, cliente: clientePorDefecto, items: carrito, total: total, igv: igv, subtotal: subtotal, categoria: 'TICKET RÁPIDO' })
    setCarrito([]); setProcesandoCobro(false); setModalBoletaOpen(true); buscarProductos(); cargarVentasNubeHoy(user.id)
  }

  const handleProcesarPagoNubeOficial = async (e) => {
    e.preventDefault(); if (!clienteDni.trim() || !clienteNombre.trim()) return mostrarNotificacion('Campos vacíos.', 'error')
    setProcesandoCobro(true)
    const clienteOficial = { dni: clienteDni, nombre: clienteNombre, direccion: clienteDireccion || 'S/N' }
    const estructuraJsonItems = { 
      items: carrito.map(item => ({ producto_id: item.id, nombre: item.nombre, cantidad: item.cantidad, precio_cobrado: item.precio_venta, unidad_medida: item.esPorPeso ? 'KG' : 'UND' })), 
      metodo_pago: metodoPagoVenta,
      tipo_comprobante: 'OFICIAL'
    }

    if (registrarComoCasero) await supabase.from('clientes_frecuentes').upsert([{ dni: clienteOficial.dni, nombre: clienteOficial.nombre, direccion: clienteOficial.direccion }], { onConflict: 'dni' })
    const { error: errorVenta } = await supabase.from('ventas_nube').insert([{ total: total, vendedor_id: user.id, cliente: clienteOficial.nombre, dni: clienteOficial.dni, ticket_json: estructuraJsonItems }])
    if (errorVenta) { setProcesandoCobro(false); return mostrarNotificacion(`Error: ${errorVenta.message}`, 'error') }

    // Descontar Stock Oficialmente
    for (const item of carrito) {
      await supabase.from('productos').update({ stock_actual: item.stock_actual - item.cantidad }).eq('id', item.id)
    }

    await purgarPedidoVirtualAtendido() 

    const numRandom = Math.floor(1000 + Math.random() * 9000); const serieBoletaOficial = `B001-${String(numRandom).padStart(8, '0')}`
    setBoletaData({ numOperacion: serieBoletaOficial, fecha: new Date().toLocaleString(), cajero: user.nombre, cliente: clienteOficial, items: carrito, total: total, igv: igv, subtotal: subtotal, categoria: 'BOLETA DE VENTA ELECTRÓNICA' })
    
    setCarrito([]); setClienteDni(''); setClienteNombre(''); setClienteDireccion(''); setRegistrarComoCasero(false); setProcesandoCobro(false); setModalClienteOpen(false); setModalBoletaOpen(true); buscarProductos(); cargarVentasNubeHoy(user.id)
  }

  const descargarCuadreDeCaja = async () => {
    let contenidoReporte = `==================================================\n`;
    contenidoReporte += `       EMPORIO - REPORTE DE CUADRE DE CAJA        \n`;
    contenidoReporte += `==================================================\n\n`;
    contenidoReporte += `FECHA DE CIERRE : ${new Date().toLocaleString()}\n`;
    contenidoReporte += `OPERADOR CAJERO : ${user.nombre.toUpperCase()}\n`;
    contenidoReporte += `--------------------------------------------------\n`;
    contenidoReporte += `RESUMEN DE FONDOS RECAUDADOS:\n`;
    contenidoReporte += `💵 TOTAL EFECTIVO FISICO  : S/ ${arqueoEfectivo.toFixed(2)}\n`;
    contenidoReporte += `📱 TOTAL DIGITAL (YAPE/T) : S/ ${arqueoDigital.toFixed(2)}\n`;
    contenidoReporte += `⭐ GRAN TOTAL GENERAL     : S/ ${granTotalDia.toFixed(2)}\n`;
    contenidoReporte += `--------------------------------------------------\n\n`;
    
    const ventasOficiales = ventasNubeHoy.filter(v => v.ticket_json?.tipo_comprobante === 'OFICIAL')
    const ventasAlPaso = ventasNubeHoy.filter(v => v.ticket_json?.tipo_comprobante === 'AL PASO')

    contenidoReporte += `🌐 [VENTAS OFICIALES] DETALLE DE COMPROBANTES EMITIDOS:\n`;
    if (ventasOficiales.length === 0) {
      contenidoReporte += `Sin transacciones registradas.\n`;
    } else {
      ventasOficiales.forEach((v, idx) => {
        contenidoReporte += `[${idx+1}] CLIENTE: ${v.cliente} | DNI: ${v.dni} | RECAUDADO: S/ ${parseFloat(v.total).toFixed(2)}\n`;
      });
    }
    
    contenidoReporte += `\n--------------------------------------------------\n\n`;
    contenidoReporte += `🚶‍♂️ [VENTAS AL PASO] DETALLE DE TICKETS RÁPIDOS:\n`;
    if (ventasAlPaso.length === 0) {
      contenidoReporte += `Sin transacciones registradas.\n`;
    } else {
      ventasAlPaso.forEach((v, idx) => {
        const ref = v.ticket_json?.id_ticket || `T00X`
        const via = v.ticket_json?.metodo_pago || 'efectivo'
        contenidoReporte += `[${idx+1}] REF: ${ref} | CLIENTE: ${v.cliente} | TOTAL: S/ ${v.total} | VIA: ${via.toUpperCase()}\n`;
      });
    }
    contenidoReporte += `\n==================================================\n`;

    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([contenidoReporte], { type: 'text/plain;charset=utf-8' }))
    link.download = `CUADRE_CAJA_${user.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`
    link.click()
    
    setModalCierreCajaOpen(false)
    mostrarNotificacion('Reporte descargado con éxito. Puedes cerrar sesión de forma segura.')
  }

  const handleImprimirVoucher = () => {
    if (!boletaData) return
    const convertirMontoALetras = (monto) => {
      const t = Math.floor(monto); const centavos = Math.round((monto - t) * 100);
      const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']; const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']; const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
      let textoEntero = ''; if (t === 0) textoEntero = 'CERO'; else if (t >= 10 && t < 20) textoEntero = especiales[t - 10]; else { const u = t % 10; const d = Math.floor(t / 10) % 10; const c = Math.floor(t / 100); let txtC = c === 1 ? (u === 0 && d === 0 ? 'CIEN' : 'CIENTO') : (c === 2 ? 'DOSCIENTOS' : c === 3 ? 'TRESCIENTOS' : c === 5 ? 'QUINIENTOS' : c > 0 ? unidades[c] + 'CIENTOS' : ''); let txtD = d === 2 && u > 0 ? 'VEINTI' : decenas[d]; let txtU = u > 0 ? unidades[u] : ''; if (d > 2 && u > 0) textoEntero = `${txtC} ${txtD} Y ${txtU}`; else textoEntero = `${txtC} ${txtD}${txtU}`; } return `${textoEntero.trim()} Y ${String(centavos).padStart(2, '0')}/100 PEN`;
    };

    const ventanaImpresion = window.open('', '_blank', 'width=400,height=600')
    const ticketHTML = `<html><head><title>Impresion</title><style>@page { margin: 0; } body { font-family: 'Arial', 'Helvetica', sans-serif; font-size: 9.5px; font-weight: bold; color: #000000 !important; margin: 0; padding: 4px; width: 64mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .center { text-align: center; } .right { text-align: right; } .bold { font-weight: 900; } .solid-line { border-bottom: 1.5px solid #000000 !important; margin: 4px 0; width: 100%; } table { width: 100%; border-collapse: collapse; margin: 2px 0; } th { font-size: 9px; font-weight: 900; padding: 1px 0; text-align: left; } td { font-size: 9px; font-weight: bold; color: #000000 !important; padding: 2px 0; vertical-align: top; }</style></head><body><div class="center bold" style="font-size: 11.5px; letter-spacing: 0.3px;">${boletaData.categoria.toUpperCase()}</div><div class="center font-mono" style="font-size: 11px; margin-top: 2px;">${boletaData.numOperacion}</div><div class="solid-line"></div><div>Señores : ${boletaData.cliente.nombre.toUpperCase()}</div><div>${boletaData.cliente.dni.length > 8 ? 'RUC.' : 'DNI.'} : ${boletaData.cliente.dni}</div><div class="solid-line"></div><div>Fecha : ${boletaData.fecha}</div><div class="solid-line"></div><table><thead><tr><th style="width: 52%;">Producto</th><th class="right" style="width: 13%;">Cant.</th><th class="right" style="width: 17%;">Precio</th><th class="right" style="width: 18%;">Importe</th></tr></thead><tbody>${boletaData.items.map(it => `<tr><td style="color: #000000 !important; text-transform: uppercase;">${it.nombre}</td><td class="right" style="color: #000000 !important;">${parseFloat(it.cantidad).toFixed(1)}</td><td class="right" style="color: #000000 !important;">${it.precio_venta.toFixed(2)}</td><td class="right" style="color: #000000 !important;">${(it.precio_venta * it.cantidad).toFixed(2)}</td></tr>`).join('')}</tbody></table><div class="solid-line"></div><table class="totals-table"><tr><td>OP. GRAVADAS</td><td class="right">S/ ${boletaData.subtotal.toFixed(2)}</td></tr><tr><td>OP. GRATUITAS</td><td class="right">S/ 00.00</td></tr><tr><td>OP. EXONERADAS</td><td class="right">S/ 00.00</td></tr><tr><td>OP. INAFECTAS</td><td class="right">S/ 00.00</td></tr><tr><td>I.G.V</td><td class="right">S/ ${boletaData.igv.toFixed(2)}</td></tr><tr><td>SUB TOTAL</td><td class="right">S/ ${boletaData.subtotal.toFixed(2)}</td></tr><tr><td class="bold" style="font-size: 10.5px;">TOTAL VENTA</td><td class="right bold" style="font-size: 10.5px;">S/ ${boletaData.total.toFixed(2)}</td></tr></table><div class="center" style="font-size: 8px; margin: 5px 0; text-transform: uppercase;">${convertirMontoALetras(boletaData.total)}</div><div class="solid-line"></div><div class="bold" style="font-size: 9px; text-transform: uppercase;">VENDEDOR(A): ${boletaData.cajero}</div><div class="solid-line"></div><div class="center" style="font-size: 9px; font-weight: bold; padding: 1px 0;">Gracias por su preferencia</div></body><script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 300); }</script></html>`
    ventanaImpresion.document.write(ticketHTML); ventanaImpresion.document.close()
  }
  const cerrarModalBoucherFinal = () => { setModalBoletaOpen(false); setTimeout(() => inputBusquedaRef.current?.focus(), 50) }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-3 sm:p-5 relative selection:bg-emerald-500/30">
      
      {toast.show && <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-500/20 bg-slate-900/95 backdrop-blur-xl shadow-xl animate-fadeIn"><p className="text-[11px] font-bold text-emerald-100">{toast.message}</p></div>}

      {alertasCriticas.length > 0 && (
        <div className="w-full max-w-[1400px] mx-auto mb-4 bg-red-950/40 border border-red-500/30 rounded-xl p-3 animate-pulse">
          {alertasCriticas.map((alerta, i) => (
            <p key={i} className="text-[11px] font-black tracking-widest text-red-400 text-center uppercase">{alerta}</p>
          ))}
        </div>
      )}

      <div className="w-full max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-5 pb-4 border-b border-white/5 gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300">EMPORIO POS</h1>
            <p className="text-xs text-slate-400 mt-0.5">Operador: <span className="text-white font-bold">{user?.nombre}</span></p>
          </div>
          <div className="hidden sm:block px-4 py-1.5 bg-slate-900/80 border border-white/5 rounded-xl text-center">
            <p className="text-[9px] text-slate-500 uppercase font-black">Ventas de Hoy</p>
            <p className="text-sm font-mono font-black text-emerald-400">S/ {granTotalDia.toFixed(2)}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {user?.rol === 'admin' && (
            <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-md">
              ⚙️ Volver a Admin
            </button>
          )}
          <button onClick={() => setModalCierreCajaOpen(true)} className="px-4 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all shadow-md">💰 Cuadrar Caja</button>
          <button onClick={handleCerrarSesionSeguro} className="px-4 py-2 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-bold uppercase rounded-xl border border-white/5 transition-all ml-auto md:ml-0">Salir</button>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-4 gap-5 flex-1 items-start text-xs">
        
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex flex-col min-h-[500px] shadow-xl">
          <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-indigo-400">Ordenes Web</h2>
            <button onClick={() => cargarPedidosVirtualesEnCola(user.id)} className="p-1.5 bg-slate-800 text-indigo-400 text-xs rounded-md">🔄</button>
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[440px] custom-scrollbar">
            {pedidosOnline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-40 space-y-2 pt-20">
                <span className="text-2xl">🛒</span><p className="text-[10px] font-medium">Sin pendientes</p>
              </div>
            ) : (
              pedidosOnline.map((po, i) => (
                <div key={i} className={`p-3 rounded-xl border text-[11px] transition-all ${idPedidoVirtualActivo === po.id ? 'bg-indigo-900/20 border-indigo-500/40' : 'bg-slate-950/40 border-white/5'}`}>
                  <div className="flex justify-between mb-2"><span className="font-bold text-slate-200 truncate">{po.cliente_nombre}</span><span className="text-indigo-400 font-black">S/ {parseFloat(po.total).toFixed(2)}</span></div>
                  <div className="flex justify-between text-[9px] uppercase font-bold mb-2.5">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded">{po.tipo_entrega}</span>
                    <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 rounded border border-emerald-500/10">{po.metodo_pago || 'EFECTIVO'}</span>
                  </div>
                  <button onClick={() => cargarPedidoVirtualACaja(po)} disabled={idPedidoVirtualActivo === po.id} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold uppercase rounded-lg">{idPedidoVirtualActivo === po.id ? 'Montado' : '⚡ Despachar'}</button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex flex-col min-h-[500px] shadow-xl">
          <input ref={inputBusquedaRef} type="text" placeholder="Escanear barra o escribir descripción..." value={buscar} onChange={(e) => setBuscar(e.target.value)} onKeyDown={handleKeyDownBusqueda} className="w-full px-4 py-2.5 mb-4 bg-slate-950 border border-white/5 focus:border-emerald-500/40 rounded-xl text-xs text-white focus:outline-none" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 max-h-[400px] custom-scrollbar">
            {productos.filter(p => p.nombre.toLowerCase().includes(buscar.toLowerCase()) || p.codigo_barras.includes(buscar)).map((p, idx) => (
              <div key={idx} className="relative p-3 bg-slate-950/40 border border-white/5 hover:border-emerald-500/30 rounded-xl text-left flex justify-between items-center group transition-all">
                <button onClick={(e) => { e.stopPropagation(); setProductoAEditar(p); setModalEdicionProductoOpen(true); }} className="absolute top-2 right-2 p-1.5 bg-slate-900 text-slate-500 hover:text-emerald-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" title="Editar Stock/Precio">✏️</button>
                <button onClick={() => agregarAlCarrito(p)} className="flex-1 text-left flex justify-between pr-8">
                  <div className="min-w-0 pr-2">
                    <p className={`font-bold text-xs truncate ${p.stock_actual <= 0 ? 'text-red-400' : 'text-slate-300 group-hover:text-emerald-400'}`}>{p.nombre}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.codigo_barras}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-400">S/ {parseFloat(p.precio_venta).toFixed(2)}</p>
                    <span className={`text-[9px] font-bold block mt-0.5 ${p.stock_actual <= 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>Stk: {p.stock_actual}</span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between min-h-[500px] shadow-2xl">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Caja Actual</h2>
              {carrito.length > 0 && <button onClick={limpiarCajaCompleta} className="text-[9px] text-red-400 font-bold uppercase px-2 py-0.5 bg-red-950/20 rounded-md">Vaciar</button>}
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[220px] custom-scrollbar">
              {carrito.length === 0 ? <p className="text-[11px] text-slate-600 italic text-center py-20">Caja libre</p> : (
                carrito.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-slate-950/60 rounded-xl border border-white/5 text-xs">
                    <div className="truncate flex-1 pr-1.5"><p className="font-bold text-slate-300 truncate text-[11px]">{item.nombre}</p></div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" step={item.esPorPeso ? "0.50" : "1"} min="0.50" value={item.cantidad} onChange={(e) => handleCambiarCantidadCarrito(item.codigo_barras, e.target.value)} className="w-11 text-center py-0.5 bg-slate-900 border border-white/5 rounded text-[11px] text-white focus:outline-none" />
                      <span className="font-bold font-mono text-emerald-400 w-12 text-right">S/ {(item.precio_venta * item.cantidad).toFixed(2)}</span>
                      <button onClick={() => eliminarDelCarrito(item.codigo_barras)} className="text-slate-600 hover:text-red-400 text-xs pl-1">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 space-y-3">
            <div className="flex gap-2 bg-slate-950 p-1.5 rounded-lg border border-white/5">
              <label className="text-[9px] text-slate-400 uppercase font-bold flex items-center pl-1">Vía:</label>
              <select value={metodoPagoVenta} onChange={(e) => setMetodoPagoVenta(e.target.value)} className="flex-1 bg-transparent text-[10px] text-emerald-400 font-bold uppercase focus:outline-none text-right">
                <option value="efectivo">💵 Efectivo</option>
                <option value="yape">📱 Yape/Plin</option>
                <option value="transferencia">🏦 Transf.</option>
              </select>
            </div>

            <div className="bg-slate-950 p-1 rounded-lg border border-white/5 flex gap-1">
              <button onClick={() => setTipoVenta('al_paso')} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded ${tipoVenta === 'al_paso' ? 'bg-amber-600 text-white' : 'text-slate-500'}`}>🚶‍♂️ Al Paso</button>
              <button onClick={() => setTipoVenta('oficial')} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded ${tipoVenta === 'oficial' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>📝 Oficial</button>
            </div>
            
            <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</span>
              <span className="text-2xl font-black font-mono text-emerald-400">S/ {total.toFixed(2)}</span>
            </div>
            
            <button onClick={handleBotonCobrarPrincipal} disabled={carrito.length === 0 || procesandoCobro} className={`w-full py-2.5 text-white font-black text-xs tracking-wider rounded-xl uppercase transition-all ${tipoVenta === 'oficial' ? 'bg-gradient-to-r from-emerald-600 to-teal-500' : 'bg-gradient-to-r from-amber-600 to-orange-500'}`}>
              {procesandoCobro ? 'Procesando...' : 'Emitir y Cobrar'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── MODALS ─── */}
      {modalCierreCajaOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl animate-fadeIn relative overflow-hidden">
            <button onClick={() => setModalCierreCajaOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold">✕</button>
            <h2 className="text-lg font-black uppercase tracking-widest text-indigo-400 text-center mb-1">Cuadrar Caja</h2>
            <p className="text-[10px] text-slate-400 text-center mb-6">Arqueo generado el {new Date().toLocaleDateString()}</p>
            
            <div className="space-y-4 bg-slate-950 p-5 rounded-xl border border-white/5 mb-6">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <div><p className="text-[10px] text-slate-500 font-bold uppercase">Dinero Físico (Billetes/Monedas)</p><p className="text-xs text-slate-300">Ventas en Efectivo</p></div>
                <p className="text-xl font-black font-mono text-emerald-400">S/ {arqueoEfectivo.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <div><p className="text-[10px] text-slate-500 font-bold uppercase">Dinero Digital</p><p className="text-xs text-slate-300">Yape, Plin y Transf.</p></div>
                <p className="text-xl font-black font-mono text-cyan-400">S/ {arqueoDigital.toFixed(2)}</p>
              </div>
              <div className="flex justify-between items-end pt-2">
                <p className="text-sm font-black uppercase tracking-widest text-slate-200">Total Facturado</p>
                <p className="text-2xl font-black font-mono text-white">S/ {granTotalDia.toFixed(2)}</p>
              </div>
            </div>
            
            <button onClick={descargarCuadreDeCaja} className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg">
              Cerrar Turno y Descargar
            </button>
            <p className="text-[9px] text-slate-500 text-center mt-3">Descargará el balance completo (.txt) de tu turno.</p>
          </div>
        </div>
      )}

      {modalEdicionProductoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl animate-fadeIn">
            <h3 className="text-xs font-black tracking-widest text-emerald-400 uppercase mb-4">Editar Producto</h3>
            <p className="text-sm font-bold text-slate-200 truncate mb-4">{productoAEditar.nombre}</p>
            <form onSubmit={guardarEdicionRapida} className="space-y-4">
              <div><label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Precio Venta (S/)</label><input type="number" step="0.50" value={productoAEditar.precio_venta} onChange={(e) => setProductoAEditar({...productoAEditar, precio_venta: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none" required /></div>
              <div><label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Stock Físico Real</label><input type="number" step="1" value={productoAEditar.stock_actual} onChange={(e) => setProductoAEditar({...productoAEditar, stock_actual: e.target.value})} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none" required /></div>
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setModalEdicionProductoOpen(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 text-[10px] font-bold uppercase rounded-lg">Cancelar</button><button type="submit" className="flex-1 py-2 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded-lg shadow-lg">Guardar</button></div>
            </form>
          </div>
        </div>
      )}

      {modalClienteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <div><h3 className="text-sm font-bold tracking-wider text-emerald-400 uppercase">Facturación Oficial</h3></div>
              <button type="button" onClick={() => { setModalCaserosOpen(true); cargarListaCaseros(); }} className="px-2.5 py-1.5 bg-indigo-600/20 text-indigo-400 text-[10px] font-black uppercase border border-indigo-500/20 rounded-xl">👥 Ver Caseros</button>
            </div>
            <form onSubmit={handleProcesarPagoNubeOficial} className="space-y-4 text-xs">
              <div className="space-y-3">
                <div><label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">DNI / RUC o ID Casero</label><input type="text" value={clienteDni} onChange={(e) => setClienteDni(e.target.value)} placeholder="Ej: 10001 o DNI" className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs font-mono text-white focus:outline-none" required /></div>
                <div><label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Nombres / Razón Social</label><input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombres del comprador" className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none" required /></div>
                <div><label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">Dirección</label><input type="text" value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} placeholder="Dirección de envío" className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none" /></div>
                <div className="flex items-center gap-2 pt-1 border-t border-white/5 mt-2"><input type="checkbox" id="chkCasero" checked={registrarComoCasero} onChange={(e) => setRegistrarComoCasero(e.target.checked)} className="rounded bg-slate-950 border-white/10 text-emerald-500 focus:ring-0 cursor-pointer w-3.5 h-3.5" /><label htmlFor="chkCasero" className="text-[9px] text-slate-400 font-bold uppercase tracking-wider cursor-pointer">💾 Guardar como casero frecuente</label></div>
              </div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setModalClienteOpen(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg">Cancelar</button><button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg">Confirmar</button></div>
            </form>
          </div>
        </div>
      )}

      {modalCaserosOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center border-b border-white/5 pb-2"><h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Directorio de Caseros</h4><button type="button" onClick={() => setModalCaserosOpen(false)} className="text-slate-400 hover:text-white text-sm font-bold">✕</button></div>
            <input type="text" placeholder="🔍 Buscar por ID, Nombre o DNI..." value={buscarCasero} onChange={(e) => setBuscarCasero(e.target.value)} className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none" />
            <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
              {listaCaseros.filter(c => c.id.toString().includes(buscarCasero) || c.nombre.toLowerCase().includes(buscarCasero.toLowerCase()) || c.dni.includes(buscarCasero)).map((c, idx) => (
                <button key={idx} type="button" onClick={() => { setClienteDni(c.dni); setClienteNombre(c.nombre); setClienteDireccion(c.direccion); setModalCaserosOpen(false); }} className="w-full p-2.5 bg-slate-950/60 hover:bg-slate-800 border border-white/5 rounded-xl text-left flex justify-between items-center transition-all"><div className="truncate pr-2"><p className="font-bold text-slate-200 text-xs uppercase truncate">{c.nombre}</p><p className="text-[9px] text-slate-500 font-mono truncate">DNI: {c.dni} • {c.direccion}</p></div><span className="px-1.5 py-0.5 bg-indigo-950/60 text-indigo-400 font-mono text-[9px] rounded font-bold border border-indigo-500/20 shrink-0">ID: {c.id}</span></button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalBoletaOpen && boletaData && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white text-slate-900 rounded-xl p-5 font-mono text-[11px] space-y-3 shadow-2xl">
            <div className="text-center border-b border-slate-300 pb-2"><h2 className="text-xs font-black">EMPORIO S.A.C.</h2><p className="text-[9px] text-slate-600">JULIACA</p><p className="text-[9px] font-bold uppercase text-indigo-700 mt-1">[{boletaData.categoria}]</p></div>
            <div className="space-y-0.5 text-[10px]"><p><b>CORRELATIVO:</b> {boletaData.numOperacion}</p><p><b>CLIENTE:</b> {boletaData.cliente.nombre.toUpperCase()}</p><p><b>DNI/RUC:</b> {boletaData.cliente.dni}</p></div>
            <div className="border-b border-dashed border-slate-300 pb-2 max-h-[120px] overflow-y-auto">{boletaData.items.map((it, idx) => ( <div key={idx} className="flex justify-between text-[10px] mb-1"><span>{it.nombre.toUpperCase()} (x{parseFloat(it.cantidad).toFixed(1)})</span><span>S/ {(it.precio_venta * it.cantidad).toFixed(2)}</span></div> ))}</div>
            <div className="text-right font-black text-xs">TOTAL: S/ {boletaData.total.toFixed(2)}</div>
            <div className="flex gap-2 pt-1"><button onClick={handleImprimirVoucher} className="flex-1 py-2 bg-slate-900 text-white font-bold rounded-lg">🖨️ Imprimir Ticket</button><button onClick={cerrarModalBoucherFinal} className="px-4 py-2 bg-slate-200 text-slate-800 font-bold rounded-lg">Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}