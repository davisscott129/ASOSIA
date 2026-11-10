// Backend de demostración: guarda todo en el navegador (localStorage) y
// replica exactamente las reglas de supabase/schema.sql.
const KEY = 'asosia-crm-demo-db'
const ROL_KEY = 'asosia-crm-demo-rol'
const TABLAS = ['autorizados', 'productos', 'clientes', 'eventos', 'proveedores', 'metas', 'ventas', 'venta_items',
  'compras', 'compra_items', 'gastos', 'movimientos', 'ajustes_stock']

const USUARIOS = {
  admin: { email: 'junta.asosia@gmail.com', nombre: 'Junta Directiva ASOSIA', rol: 'admin' },
  manager: { email: 'tesoreria@demo.asosia', nombre: 'Manager (demo)', rol: 'manager' },
  vendedor: { email: 'vendedor@demo.asosia', nombre: 'Vendedor (demo)', rol: 'vendedor' },
}

let db = null
let fechaForzada = null
const listeners = new Set()
const ahora = () => (fechaForzada ? new Date(fechaForzada) : new Date()).toISOString()
const hoy = () => ahora().slice(0, 10)
const r2 = (n) => Math.round(n * 100) / 100

function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* sin almacenamiento: queda en memoria */ }
}
function cargar() {
  if (db) return
  try { db = JSON.parse(localStorage.getItem(KEY)) } catch { db = null }
  if (!db || !db.productos) sembrar()
}
function nuevo(tabla, fila, clave = 'id') {
  db._seq[tabla] = (db._seq[tabla] || 0) + 1
  const f = clave === 'id' ? { id: db._seq[tabla], ...fila } : { ...fila }
  db[tabla].push(f)
  return f
}
const porId = (tabla, id) => db[tabla].find((x) => x.id === Number(id))

let rolMem
const leerRol = () => { if (rolMem === undefined) { try { rolMem = localStorage.getItem(ROL_KEY) } catch { rolMem = null } } return rolMem }
const ponerRol = (r) => { rolMem = r; try { r ? localStorage.setItem(ROL_KEY, r) : localStorage.removeItem(ROL_KEY) } catch { /* sin almacenamiento */ } }
function quien() {
  const rol = leerRol()
  return rol ? USUARIOS[rol] : null
}
function rolActual() {
  const u = quien()
  if (!u) return null
  const a = db.autorizados.find((x) => x.email === u.email && x.activo)
  return a?.rol || null
}
const acceso = () => { if (!rolActual()) throw new Error('Sin permiso') }
const staff = (msg = 'Tu rol no tiene permiso para hacer esto.') => {
  if (!['admin', 'manager'].includes(rolActual())) throw new Error(msg)
}
const yo = () => quien()?.email

// ---------------- Operaciones (mismas reglas que el SQL) ----------------
const RPC = {
  mi_perfil() {
    const u = quien()
    const a = u && db.autorizados.find((x) => x.email === u.email && x.activo)
    return a ? { email: a.email, nombre: a.nombre, rol: a.rol } : null
  },
  saldos() {
    staff()
    const s = (c) => r2(db.movimientos.filter((m) => m.cuenta === c).reduce((a, m) => a + m.monto, 0))
    return { efectivo: s('efectivo'), banco: s('banco') }
  },
  registrar_venta({ p }) {
    acceso()
    const items = p.items || []
    if (!items.length) throw new Error('La venta no tiene productos')
    let sub = 0
    const filas = items.map((it) => {
      const prod = porId('productos', it.producto_id)
      if (!prod) throw new Error('Un producto ya no existe')
      const cant = Number(it.cantidad)
      const precio = it.precio != null ? Number(it.precio) : prod.precio
      if (!(cant > 0)) throw new Error('Cantidad inválida')
      if (!prod.es_servicio && prod.stock < cant) throw new Error(`No hay suficiente stock de ${prod.nombre} (quedan ${prod.stock})`)
      sub += cant * precio
      return { prod, cant, precio }
    })
    const desc = Number(p.descuento) || 0
    const total = Math.max(sub - desc, 0)
    const pago = Math.min(Math.max(Number(p.pago) || 0, 0), total)
    if (pago < total && !p.cliente_id) throw new Error('Para dejar saldo pendiente (fiado) tenés que elegir un cliente')
    const v = nuevo('ventas', {
      fecha: ahora(), cliente_id: p.cliente_id || null, canal: p.canal || 'general', evento_id: p.evento_id || null,
      subtotal: r2(sub), descuento: desc, total: r2(total), pagado: r2(pago), estado: pago >= total ? 'pagada' : 'pendiente',
      notas: p.notas || null, vendedor_email: yo(),
    })
    for (const { prod, cant, precio } of filas) {
      nuevo('venta_items', { venta_id: v.id, producto_id: prod.id, nombre: prod.variante ? `${prod.nombre} · ${prod.variante}` : prod.nombre, cantidad: cant, precio, costo: prod.costo })
      if (!prod.es_servicio) prod.stock = r2(prod.stock - cant)
    }
    if (pago > 0) nuevo('movimientos', { fecha: ahora(), cuenta: p.cuenta || 'efectivo', monto: r2(pago), tipo: 'venta', venta_id: v.id, nota: `Venta #${v.id}`, creado_por: yo() })
    return v.id
  },
  cobrar_venta({ p_venta, p_monto, p_cuenta }) {
    acceso()
    const v = porId('ventas', p_venta)
    if (!v || v.estado === 'anulada') throw new Error('Venta no válida')
    const m = Number(p_monto)
    if (!(m > 0) || m > r2(v.total - v.pagado)) throw new Error('Monto inválido')
    v.pagado = r2(v.pagado + m)
    v.estado = v.pagado >= v.total ? 'pagada' : 'pendiente'
    nuevo('movimientos', { fecha: ahora(), cuenta: p_cuenta, monto: m, tipo: 'cobro', venta_id: v.id, nota: `Cobro venta #${v.id}`, creado_por: yo() })
  },
  anular_venta({ p_venta }) {
    staff('Solo admin o manager pueden anular ventas')
    const v = porId('ventas', p_venta)
    if (!v || v.estado === 'anulada') throw new Error('Venta no válida')
    for (const it of db.venta_items.filter((i) => i.venta_id === v.id)) {
      const prod = porId('productos', it.producto_id)
      if (prod && !prod.es_servicio) prod.stock = r2(prod.stock + it.cantidad)
    }
    revertir('venta_id', v.id, `Anulación venta #${v.id}`)
    v.estado = 'anulada'
    v.pagado = 0
  },
  registrar_compra({ p }) {
    staff()
    const items = p.items || []
    if (!items.length) throw new Error('La compra no tiene productos')
    const c = nuevo('compras', { fecha: p.fecha || hoy(), proveedor_id: p.proveedor_id || null, evento_id: p.evento_id || null, total: 0, pagado: 0, estado: 'pagada', notas: p.notas || null, creado_por: yo(), creado_at: ahora() })
    let total = 0
    for (const it of items) {
      const prod = porId('productos', it.producto_id)
      if (!prod) throw new Error('Un producto ya no existe')
      const cant = Number(it.cantidad); const costo = Number(it.costo)
      nuevo('compra_items', { compra_id: c.id, producto_id: prod.id, nombre: prod.variante ? `${prod.nombre} · ${prod.variante}` : prod.nombre, cantidad: cant, costo })
      const base = Math.max(prod.stock, 0)
      prod.costo = base + cant > 0 ? r2((base * prod.costo + cant * costo) / (base + cant)) : costo
      prod.stock = r2(prod.stock + cant)
      total += cant * costo
    }
    const pago = Math.min(Math.max(Number(p.pago) || 0, 0), total)
    Object.assign(c, { total: r2(total), pagado: r2(pago), estado: pago >= total ? 'pagada' : 'pendiente' })
    if (pago > 0) nuevo('movimientos', { fecha: ahora(), cuenta: p.cuenta || 'efectivo', monto: -r2(pago), tipo: 'compra', compra_id: c.id, nota: `Compra #${c.id}`, creado_por: yo() })
    return c.id
  },
  pagar_compra({ p_compra, p_monto, p_cuenta }) {
    staff()
    const c = porId('compras', p_compra)
    if (!c) throw new Error('Compra no existe')
    const m = Number(p_monto)
    if (!(m > 0) || m > r2(c.total - c.pagado)) throw new Error('Monto inválido')
    c.pagado = r2(c.pagado + m)
    c.estado = c.pagado >= c.total ? 'pagada' : 'pendiente'
    nuevo('movimientos', { fecha: ahora(), cuenta: p_cuenta, monto: -m, tipo: 'compra', compra_id: c.id, nota: `Pago compra #${c.id}`, creado_por: yo() })
  },
  registrar_gasto({ p }) {
    staff()
    const monto = Number(p.monto)
    if (!(monto > 0)) throw new Error('Monto inválido')
    const pagado = p.pagado !== false
    const g = nuevo('gastos', { fecha: p.fecha || hoy(), categoria: p.categoria || 'Otros', descripcion: p.descripcion, monto, pagado, anulado: false, cuenta: pagado ? p.cuenta || 'efectivo' : null, evento_id: p.evento_id || null, proveedor_id: p.proveedor_id || null, creado_por: yo(), creado_at: ahora() })
    if (pagado) nuevo('movimientos', { fecha: ahora(), cuenta: g.cuenta, monto: -monto, tipo: 'gasto', gasto_id: g.id, nota: g.descripcion, creado_por: yo() })
    return g.id
  },
  pagar_gasto({ p_gasto, p_cuenta }) {
    staff()
    const g = porId('gastos', p_gasto)
    if (!g || g.pagado || g.anulado) throw new Error('Gasto no válido')
    g.pagado = true; g.cuenta = p_cuenta
    nuevo('movimientos', { fecha: ahora(), cuenta: p_cuenta, monto: -g.monto, tipo: 'gasto', gasto_id: g.id, nota: g.descripcion, creado_por: yo() })
  },
  anular_gasto({ p_gasto }) {
    staff()
    const g = porId('gastos', p_gasto)
    if (!g || g.anulado) throw new Error('Gasto no válido')
    revertir('gasto_id', g.id, `Anulación gasto: ${g.descripcion}`)
    g.anulado = true
  },
  traslado({ p_monto, p_de, p_a, p_nota }) {
    staff()
    const m = Number(p_monto)
    if (!(m > 0) || p_de === p_a) throw new Error('Traslado inválido')
    nuevo('movimientos', { fecha: ahora(), cuenta: p_de, monto: -m, tipo: 'traslado', nota: p_nota || `Traslado a ${p_a}`, creado_por: yo() })
    nuevo('movimientos', { fecha: ahora(), cuenta: p_a, monto: m, tipo: 'traslado', nota: p_nota || `Traslado desde ${p_de}`, creado_por: yo() })
  },
  ajuste_caja({ p_cuenta, p_saldo_real, p_nota }) {
    staff()
    const actual = db.movimientos.filter((m) => m.cuenta === p_cuenta).reduce((a, m) => a + m.monto, 0)
    const dif = r2(Number(p_saldo_real) - actual)
    if (dif !== 0) nuevo('movimientos', { fecha: ahora(), cuenta: p_cuenta, monto: dif, tipo: 'ajuste', nota: p_nota || 'Ajuste de caja', creado_por: yo() })
  },
  ajustar_stock({ p_producto, p_cantidad, p_motivo, p_nota, p_evento }) {
    staff()
    const prod = porId('productos', p_producto)
    if (!prod) throw new Error('Producto no existe')
    const c = Number(p_cantidad)
    if (!c) return
    nuevo('ajustes_stock', { fecha: ahora(), producto_id: prod.id, cantidad: c, motivo: p_motivo, costo: prod.costo, evento_id: p_evento || null, nota: p_nota || null, creado_por: yo() })
    prod.stock = r2(prod.stock + c)
  },
}

function revertir(campo, id, nota) {
  const porCuenta = {}
  for (const m of db.movimientos.filter((x) => x[campo] === id)) porCuenta[m.cuenta] = (porCuenta[m.cuenta] || 0) + m.monto
  for (const [cuenta, s] of Object.entries(porCuenta)) {
    if (r2(s) !== 0) nuevo('movimientos', { fecha: ahora(), cuenta, monto: -r2(s), tipo: 'anulacion', [campo]: id, nota, creado_por: yo() })
  }
}

// Permisos de lectura/escritura directa por tabla (igual que las políticas RLS)
const LECTURA_STAFF = ['proveedores', 'metas', 'compras', 'compra_items', 'gastos', 'movimientos', 'ajustes_stock']
function puedeLeer(tabla) {
  const rol = rolActual()
  if (!rol) return false
  if (tabla === 'autorizados') return true
  if (LECTURA_STAFF.includes(tabla)) return rol !== 'vendedor'
  return true
}
function puedeEscribir(tabla, op) {
  const rol = rolActual()
  if (tabla === 'autorizados') return rol === 'admin'
  if (tabla === 'clientes') return op === 'delete' ? rol !== 'vendedor' : !!rol
  if (['productos', 'eventos', 'proveedores', 'metas'].includes(tabla)) return rol === 'admin' || rol === 'manager'
  return false
}
const sinPermiso = () => { throw new Error('Tu rol no tiene permiso para hacer esto.') }

function protegerAdmin(antes, despues) {
  if (antes.rol === 'admin' && antes.activo && (!despues || despues.rol !== 'admin' || !despues.activo)) {
    const otros = db.autorizados.filter((a) => a.rol === 'admin' && a.activo && a.email !== antes.email)
    if (!otros.length) throw new Error('Debe quedar al menos un admin activo')
  }
}

const COMP = {
  eq: (a, b) => a === b, neq: (a, b) => a !== b, gte: (a, b) => a >= b, gt: (a, b) => a > b,
  lt: (a, b) => a < b, lte: (a, b) => a <= b, in: (a, b) => b.includes(a), is: (a, b) => (a ?? null) === b,
}

const tick = () => new Promise((r) => setTimeout(r, 60))
const copia = (x) => JSON.parse(JSON.stringify(x))
function avisar() { listeners.forEach((l) => l(quien() ? { email: quien().email } : null)) }

export const backend = {
  modo: 'demo',
  usuarios: USUARIOS,
  async usuario() { cargar(); const u = quien(); return u ? { email: u.email } : null },
  onAuth(cb) { listeners.add(cb); return () => listeners.delete(cb) },
  async entrarComo(rol) { cargar(); ponerRol(rol); avisar() },
  async salir() { ponerRol(null); avisar() },
  soportaPasskey: false,
  async loginClave() { throw new Error('En la demo se entra eligiendo un rol.') },
  async loginPasskey() { throw new Error('En la demo se entra eligiendo un rol.') },
  async crearClave() { await tick() },
  async activarPasskey() { throw new Error('Face ID o huella solo funcionan en la app real.') },
  reiniciar() { sembrar(); guardar() },

  async list(tabla, o = {}) {
    cargar(); await tick()
    if (!puedeLeer(tabla)) return []
    let filas = db[tabla]
    if (tabla === 'autorizados' && rolActual() !== 'admin') filas = filas.filter((a) => a.email === yo())
    for (const [op, col, val] of o.filtros || []) filas = filas.filter((f) => COMP[op](f[col] ?? null, val))
    filas = copia(filas)
    if (o.select?.includes('venta_items')) filas.forEach((v) => (v.venta_items = copia(db.venta_items.filter((i) => i.venta_id === v.id))))
    if (o.select?.includes('compra_items')) filas.forEach((c) => (c.compra_items = copia(db.compra_items.filter((i) => i.compra_id === c.id))))
    if (o.orden) {
      const [col, asc] = o.orden
      filas.sort((a, b) => ((a[col] ?? '') > (b[col] ?? '') ? 1 : (a[col] ?? '') < (b[col] ?? '') ? -1 : 0) * (asc === false ? -1 : 1))
    }
    return filas.slice(0, o.limite || 2000)
  },
  async insertar(tabla, fila) {
    cargar(); await tick()
    if (!puedeEscribir(tabla, 'insert')) sinPermiso()
    if (tabla === 'autorizados') {
      fila = { activo: true, rol: 'vendedor', ...fila, email: fila.email.trim().toLowerCase(), creado_at: ahora() }
      if (db.autorizados.some((a) => a.email === fila.email)) throw new Error('Ese correo ya tiene acceso.')
      db.autorizados.push(fila); guardar(); return copia(fila)
    }
    const f = nuevo(tabla, { creado_at: ahora(), ...fila }); guardar(); return copia(f)
  },
  async actualizar(tabla, id, cambios, clave = 'id') {
    cargar(); await tick()
    if (!puedeEscribir(tabla, 'update')) sinPermiso()
    const f = db[tabla].find((x) => x[clave] === id)
    if (!f) sinPermiso()
    if (tabla === 'autorizados') protegerAdmin(f, { ...f, ...cambios })
    Object.assign(f, cambios); guardar(); return copia(f)
  },
  async upsert(tabla, fila) {
    cargar(); await tick()
    if (!puedeEscribir(tabla, 'insert')) sinPermiso()
    const clave = tabla === 'metas' ? 'mes' : 'id'
    const f = db[tabla].find((x) => x[clave] === fila[clave])
    if (f) Object.assign(f, fila); else db[tabla].push({ ...fila })
    guardar()
  },
  async borrar(tabla, id, clave = 'id') {
    cargar(); await tick()
    if (!puedeEscribir(tabla, 'delete')) sinPermiso()
    const f = db[tabla].find((x) => x[clave] === id)
    if (tabla === 'autorizados' && f) protegerAdmin(f, null)
    if (tabla === 'clientes' && db.ventas.some((v) => v.cliente_id === id)) throw new Error('No se puede borrar porque tiene registros asociados.')
    db[tabla] = db[tabla].filter((x) => x[clave] !== id); guardar()
  },
  async rpc(nombre, args = {}) {
    cargar(); await tick()
    const antes = JSON.stringify(db)
    try {
      const r = RPC[nombre](args)
      guardar()
      return r === undefined ? null : copia(r)
    } catch (e) {
      db = JSON.parse(antes) // atómico: si falla, no queda nada a medias
      throw e
    }
  },
}

// ---------------- Datos de ejemplo ----------------
function sembrar() {
  db = { _seq: {} }
  TABLAS.forEach((t) => (db[t] = []))
  let semilla = 7
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
  const elegir = (a) => a[Math.floor(azar() * a.length)]

  Object.values(USUARIOS).forEach((u) => db.autorizados.push({ ...u, activo: true, creado_at: new Date().toISOString() }))
  const P = (nombre, variante, categoria, precio, costo, stock, minimo, extra = {}) =>
    nuevo('productos', { nombre, variante, categoria, precio, costo, stock, stock_minimo: minimo, es_servicio: false, en_asodita: true, visible_web: false, activo: true, ...extra })
  P('Café chorreado', 'vaso 8oz', 'Bebidas', 600, 180, 0, 0, { es_servicio: true })
  P('Café con leche', 'vaso 12oz', 'Bebidas', 900, 320, 0, 0, { es_servicio: true })
  P('Refresco natural', '500ml', 'Bebidas', 800, 300, 40, 10)
  P('Agua', '600ml', 'Bebidas', 600, 280, 36, 12)
  P('Empanada', 'pollo', 'Comida', 900, 450, 30, 10)
  P('Empanada', 'queso', 'Comida', 900, 420, 26, 10)
  P('Gallo pinto', 'porción', 'Comida', 1500, 650, 12, 5)
  P('Sándwich', 'jamón y queso', 'Comida', 1200, 550, 14, 6)
  P('Galletas', 'paquete', 'Snacks', 500, 250, 48, 15)
  P('Chips', 'bolsa', 'Snacks', 700, 380, 30, 10)
  P('Chocolate', 'barra', 'Snacks', 800, 420, 24, 8)
  P('Camiseta asoSIA', 'S', 'Mercadería', 7500, 3800, 6, 3, { en_asodita: false, visible_web: true })
  P('Camiseta asoSIA', 'M', 'Mercadería', 7500, 3800, 9, 3, { en_asodita: false, visible_web: true })
  P('Camiseta asoSIA', 'L', 'Mercadería', 7500, 3800, 4, 3, { en_asodita: false, visible_web: true })
  P('Taza asoSIA', null, 'Mercadería', 4500, 2200, 10, 4, { en_asodita: false, visible_web: true })
  P('Stickers', 'pack de 5', 'Mercadería', 1500, 450, 40, 10, { visible_web: true })
  P('Impresión', 'B/N por página', 'Servicios', 50, 15, 0, 0, { es_servicio: true })
  P('Entrada', 'evento', 'Eventos', 2000, 0, 0, 0, { es_servicio: true, en_asodita: false })

  const nombres = ['Valeria Mora', 'Daniel Rojas', 'María José Solís', 'Kevin Alfaro', 'Fernanda Vargas', 'Andrés Quesada', 'Sofía Jiménez', 'José Pablo Arias', 'Camila Céspedes', 'Luis Diego Brenes']
  nombres.forEach((n, i) => nuevo('clientes', { nombre: n, telefono: `8${(3100000 + i * 73311) % 10000000}`.slice(0, 8), carne: `C${String(20000 + i * 1371).slice(0, 5)}`, creado_at: new Date().toISOString() }))

  const d = (dias) => { const x = new Date(); x.setDate(x.getDate() + dias); return x }
  nuevo('eventos', { nombre: 'Semana del Bienestar', fecha: d(-20).toISOString().slice(0, 10), lugar: 'Plazoleta SIA', presupuesto: 60000, estado: 'cerrado', notas: 'Talleres y actividades recreativas' })
  nuevo('eventos', { nombre: 'Feria de Ciencia e Innovación', fecha: d(-3).toISOString().slice(0, 10), lugar: 'Auditorio', presupuesto: 80000, estado: 'activo' })
  nuevo('eventos', { nombre: 'Campeonato de Ping-Pong', fecha: d(12).toISOString().slice(0, 10), lugar: 'Gimnasio', presupuesto: 35000, estado: 'planeado' })

  nuevo('proveedores', { nombre: 'Distribuidora La Central', contacto: 'Don Carlos', telefono: '24401122' })
  nuevo('proveedores', { nombre: 'Panadería Doña Mari', contacto: 'Mari', telefono: '88776655' })
  nuevo('proveedores', { nombre: 'Estampados Alajuela', contacto: 'Ana', telefono: '24305566' })

  const mes = (x) => new Date(x.getFullYear(), x.getMonth(), 1).toISOString().slice(0, 10)
  db.metas.push({ mes: mes(new Date()), monto: 350000 })
  db.metas.push({ mes: mes(d(-31)), monto: 300000 })

  // Simula la historia corriendo las operaciones reales
  const previo = leerRol()
  ponerRol('manager')
  const corre = (dias, h, fn) => { const x = d(dias); x.setHours(h, Math.floor(azar() * 59)); fechaForzada = x.toISOString(); try { fn() } catch { /* omitir */ } }

  corre(-40, 8, () => RPC.ajuste_caja({ p_cuenta: 'efectivo', p_saldo_real: 60000, p_nota: 'Saldo inicial de caja' }))
  corre(-40, 8, () => RPC.ajuste_caja({ p_cuenta: 'banco', p_saldo_real: 320000, p_nota: 'Saldo inicial de la cuenta' }))
  corre(-38, 9, () => RPC.registrar_compra({ p: { proveedor_id: 1, items: [{ producto_id: 3, cantidad: 48, costo: 300 }, { producto_id: 4, cantidad: 48, costo: 280 }, { producto_id: 9, cantidad: 60, costo: 250 }, { producto_id: 10, cantidad: 40, costo: 380 }], pago: 999999, cuenta: 'banco' } }))
  corre(-30, 9, () => RPC.registrar_compra({ p: { proveedor_id: 3, items: [{ producto_id: 12, cantidad: 8, costo: 3800 }, { producto_id: 13, cantidad: 12, costo: 3800 }, { producto_id: 14, cantidad: 8, costo: 3800 }], pago: 50000, cuenta: 'banco', notas: 'Camisetas nuevo logo' } }))

  const asodita = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 17]
  for (let dia = -36; dia <= 0; dia++) {
    const fecha = d(dia)
    if (fecha.getDay() === 0 || fecha.getDay() === 6) continue
    if (dia % 5 === 0) corre(dia, 7, () => RPC.registrar_compra({ p: { proveedor_id: 2, items: [{ producto_id: 5, cantidad: 8, costo: 450 }, { producto_id: 6, cantidad: 6, costo: 420 }, { producto_id: 8, cantidad: 4, costo: 550 }, { producto_id: 7, cantidad: 4, costo: 650 }], pago: 999999, cuenta: 'efectivo' } }))
    const n = dia === 0 ? 4 : 3 + Math.floor(azar() * 5)
    for (let k = 0; k < n; k++) {
      const items = Array.from({ length: 1 + Math.floor(azar() * 3) }, () => ({ producto_id: elegir(asodita), cantidad: 1 + Math.floor(azar() * 2) }))
      const fiado = azar() < 0.12
      corre(dia, 7 + Math.floor(azar() * 10), () => RPC.registrar_venta({ p: { canal: 'asodita', items, cliente_id: fiado || azar() < 0.3 ? 1 + Math.floor(azar() * 10) : null, pago: fiado ? 0 : 999999, cuenta: azar() < 0.65 ? 'efectivo' : 'banco' } }))
    }
    if (azar() < 0.25) corre(dia, 15, () => RPC.registrar_venta({ p: { canal: 'general', cliente_id: 1 + Math.floor(azar() * 10), items: [{ producto_id: elegir([12, 13, 14, 15, 16]), cantidad: 1 }], pago: azar() < 0.7 ? 999999 : 3000, cuenta: 'banco' } }))
  }
  // Ventas y gastos de eventos
  for (let k = 0; k < 14; k++) corre(-20, 10 + (k % 6), () => RPC.registrar_venta({ p: { canal: 'evento', evento_id: 1, items: [{ producto_id: elegir([3, 4, 5, 9, 18]), cantidad: 1 + (k % 2) }], pago: 999999, cuenta: k % 3 ? 'efectivo' : 'banco' } }))
  for (let k = 0; k < 18; k++) corre(-3, 9 + (k % 8), () => RPC.registrar_venta({ p: { canal: 'evento', evento_id: 2, items: [{ producto_id: elegir([1, 3, 5, 6, 9, 16]), cantidad: 1 + (k % 3) }], pago: 999999, cuenta: k % 2 ? 'efectivo' : 'banco' } }))
  corre(-21, 9, () => RPC.registrar_gasto({ p: { categoria: 'Eventos', descripcion: 'Materiales talleres Bienestar', monto: 28500, cuenta: 'banco', evento_id: 1 } }))
  corre(-20, 9, () => RPC.registrar_gasto({ p: { categoria: 'Eventos', descripcion: 'Toldo y sillas', monto: 22000, cuenta: 'efectivo', evento_id: 1 } }))
  corre(-5, 9, () => RPC.registrar_gasto({ p: { categoria: 'Eventos', descripcion: 'Premios Feria de Ciencia', monto: 35000, cuenta: 'banco', evento_id: 2 } }))
  corre(-3, 8, () => RPC.registrar_gasto({ p: { categoria: 'Papelería', descripcion: 'Impresión de rótulos feria', monto: 8500, cuenta: 'efectivo', evento_id: 2 } }))
  corre(-2, 10, () => RPC.registrar_gasto({ p: { categoria: 'Eventos', descripcion: 'Trofeo Ping-Pong (abono)', monto: 18000, pagado: false, evento_id: 3, proveedor_id: 3 } }))
  corre(-33, 10, () => RPC.registrar_gasto({ p: { categoria: 'Insumos ASOdita', descripcion: 'Café molido 2kg y azúcar', monto: 14800, cuenta: 'efectivo' } }))
  corre(-12, 10, () => RPC.registrar_gasto({ p: { categoria: 'Insumos ASOdita', descripcion: 'Vasos, tapas y servilletas', monto: 9600, cuenta: 'efectivo' } }))
  corre(-8, 11, () => RPC.registrar_gasto({ p: { categoria: 'Mantenimiento', descripcion: 'Reparación cafetera', monto: 15000, cuenta: 'banco' } }))
  corre(-6, 12, () => RPC.registrar_gasto({ p: { categoria: 'Transporte', descripcion: 'Uber compra mercadería', monto: 4200, cuenta: 'efectivo' } }))
  corre(-1, 12, () => RPC.registrar_gasto({ p: { categoria: 'Servicios', descripcion: 'Recarga internet ASOdita', monto: 5000, pagado: false } }))
  corre(-4, 17, () => RPC.traslado({ p_monto: 40000, p_de: 'efectivo', p_a: 'banco', p_nota: 'Depósito de caja ASOdita' }))
  corre(-9, 9, () => RPC.ajustar_stock({ p_producto: 5, p_cantidad: -2, p_motivo: 'merma', p_nota: 'Vencidas' }))
  corre(-3, 9, () => RPC.ajustar_stock({ p_producto: 4, p_cantidad: -6, p_motivo: 'consumo', p_nota: 'Agua para jurados', p_evento: 2 }))

  fechaForzada = null
  ponerRol(previo)
  guardar()
}
