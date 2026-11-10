import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Download, ArrowLeftRight, Scale, Coffee } from 'lucide-react'
import { api } from '../data/api'
import { useCarga, useAccion, Estado, Pagina, Segmento, Seccion, MesNav, Lista, Fila, Hoja, Campo, Boton, Cuenta, Chips, Etiqueta, Vacio, Dinero, num } from '../ui'
import { colones, inicioMes, finMes, isoDia, fechaCorta, hora, sumar, nombreMes, nombreProducto, CATEGORIAS_GASTO, descargarCSV } from '../lib/format'
import { useNombres } from '../lib/nombres'

export default function Finanzas() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('t') || 'resumen'
  const [mes, setMes] = useState(inicioMes())
  return (
    <Pagina titulo="Finanzas" atras="/mas">
      <Segmento opciones={[['resumen', 'Resumen'], ['gastos', 'Gastos'], ['consumo', 'Consumo'], ['caja', 'Caja']]} valor={tab} onChange={(t) => setParams(t === 'resumen' ? {} : { t })} />
      <MesNav mes={mes} onChange={setMes} />
      {tab === 'resumen' && <Resumen mes={mes} />}
      {tab === 'gastos' && <Gastos mes={mes} />}
      {tab === 'consumo' && <Consumo mes={mes} />}
      {tab === 'caja' && <Caja mes={mes} />}
    </Pagina>
  )
}

// ---------------- Resumen ----------------
function Resumen({ mes }) {
  const [hoja, setHoja] = useState(null)
  const carga = useCarga(async () => {
    const desde = mes.toISOString(), hasta = finMes(mes).toISOString()
    const dDesde = isoDia(mes), dHasta = isoDia(finMes(mes))
    const [saldos, pendientes, productos, comprasPend, gastosPend, ventas, gastos, movs, ajustes] = await Promise.all([
      api.rpc('saldos'),
      api.list('ventas', { filtros: [['eq', 'estado', 'pendiente']] }),
      api.list('productos', { filtros: [['eq', 'activo', true], ['eq', 'es_servicio', false]] }),
      api.list('compras', { filtros: [['eq', 'estado', 'pendiente']] }),
      api.list('gastos', { filtros: [['eq', 'pagado', false], ['eq', 'anulado', false]] }),
      api.list('ventas', { select: '*, venta_items(*)', filtros: [['gte', 'fecha', desde], ['lt', 'fecha', hasta], ['neq', 'estado', 'anulada']] }),
      api.list('gastos', { filtros: [['gte', 'fecha', dDesde], ['lt', 'fecha', dHasta], ['eq', 'anulado', false]] }),
      api.list('movimientos', { filtros: [['gte', 'fecha', desde], ['lt', 'fecha', hasta]] }),
      api.list('ajustes_stock', { filtros: [['gte', 'fecha', desde], ['lt', 'fecha', hasta]] }),
    ])
    return { saldos, pendientes, productos, comprasPend, gastosPend, ventas, gastos, movs, ajustes }
  }, [mes.getTime()])

  return (
    <Estado carga={carga}>
      {carga.data && (() => {
        const d = carga.data
        const liquidez = d.saldos.efectivo + d.saldos.banco
        const porCobrar = sumar(d.pendientes, (v) => v.total - v.pagado)
        const conStock = d.productos.filter((p) => p.stock > 0)
        const inventario = sumar(conStock, (p) => p.stock * p.costo)
        const inventarioVenta = sumar(conStock, (p) => p.stock * p.precio)
        const activos = liquidez + porCobrar + inventario
        const porPagar = sumar(d.comprasPend, (c) => c.total - c.pagado) + sumar(d.gastosPend, 'monto')
        const vendido = sumar(d.ventas, 'total')
        const costo = sumar(d.ventas.flatMap((v) => v.venta_items), (i) => i.cantidad * i.costo)
        const gastos = sumar(d.gastos, 'monto')
        const salidas = d.ajustes.filter((a) => a.cantidad < 0)
        const consumoPropio = sumar(salidas.filter((a) => a.motivo === 'consumo'), (a) => -a.cantidad * a.costo)
        const perdidas = sumar(salidas.filter((a) => a.motivo !== 'consumo'), (a) => -a.cantidad * a.costo)
        const resultado = vendido - costo - gastos - consumoPropio - perdidas
        // Neto: las anulaciones restan de lo que entró (ventas) o salió (gastos)
        const entro = sumar(d.movs.filter((m) => m.venta_id != null), 'monto')
        const salio = -sumar(d.movs.filter((m) => m.compra_id != null || m.gasto_id != null), 'monto')
        const barra = (v) => <i style={{ width: `${activos ? Math.max((v / activos) * 100, 0) : 0}%` }} />
        return (
          <>
            <div className="disponible">
              <div>
                <span className="dato-label">Disponible hoy</span>
                <Dinero v={liquidez} className="disponible-cifra" />
              </div>
              <div className="cuentas">
                <span><i className="punto efectivo" />Efectivo <b className="num">{colones(d.saldos.efectivo)}</b></span>
                <span><i className="punto banco" />Banco <b className="num">{colones(d.saldos.banco)}</b></span>
              </div>
              <div className="en-linea">
                <Boton onClick={() => setHoja('traslado')}><ArrowLeftRight size={16} /> Traslado</Boton>
                <Boton onClick={() => setHoja('cuadre')}><Scale size={16} /> Cuadrar caja</Boton>
                <Boton onClick={() => setHoja('consumo')}><Coffee size={16} /> Consumo propio</Boton>
              </div>
            </div>

            <Seccion titulo="Dónde está la plata">
              <div className="reparto">
                <div className="reparto-fila"><span>Efectivo y banco</span><b className="num">{colones(liquidez)}</b><div className="reparto-barra liq">{barra(liquidez)}</div></div>
                <div className="reparto-fila"><span>Fiados por cobrar</span><b className="num">{colones(porCobrar)}</b><div className="reparto-barra cob">{barra(porCobrar)}</div></div>
                <div className="reparto-fila"><span>Inventario al costo</span><b className="num">{colones(inventario)}</b><div className="reparto-barra inv">{barra(inventario)}</div></div>
              </div>
              <div className="estado-cuenta">
                <Fila titulo="Todo lo que tiene la asociación" sub="Inventario contado a lo que costó" derecha={colones(activos)} />
                <Fila titulo="Lo que se debe" sub="Compras y gastos sin pagar" derecha={'−' + colones(porPagar)} tono={porPagar ? 'alerta' : null} />
                <Fila titulo={<strong>Patrimonio neto</strong>} derecha={<strong>{colones(activos - porPagar)}</strong>} />
              </div>
              {inventarioVenta > 0 && (
                <div className="estado-cuenta">
                  <Fila titulo="Inventario a precio de venta" sub={`${sumar(conStock, 'stock')} unidades en stock`} derecha={colones(inventarioVenta)} />
                  <Fila titulo="Ganancia esperada si se vende todo" sub={`margen ${Math.round(((inventarioVenta - inventario) / inventarioVenta) * 100)}%`} derecha={<span className="verde">{colones(inventarioVenta - inventario)}</span>} />
                </div>
              )}
            </Seccion>

            <Seccion titulo={`Resultado de ${nombreMes(mes)}`}>
              <div className="estado-cuenta">
                <Fila titulo="Ventas" sub={`${d.ventas.length} ventas`} derecha={colones(vendido)} />
                <Fila titulo="Costo de lo vendido" derecha={'−' + colones(costo)} />
                <Fila titulo="Ganancia bruta" sub={vendido ? `margen ${Math.round(((vendido - costo) / vendido) * 100)}%` : null} derecha={colones(vendido - costo)} />
                <Fila titulo="Gastos" sub={`${d.gastos.length} gastos`} derecha={'−' + colones(gastos)} />
                {consumoPropio > 0 && <Fila titulo="Consumo propio" sub="Producto usado por la asociación, al costo" derecha={'−' + colones(consumoPropio)} />}
                {perdidas > 0 && <Fila titulo="Merma, donaciones y faltantes" derecha={'−' + colones(perdidas)} />}
                <Fila titulo={<strong>{resultado >= 0 ? 'Ganancia del mes' : 'Pérdida del mes'}</strong>} derecha={<strong className={resultado >= 0 ? 'verde' : 'rojo'}>{colones(resultado)}</strong>} />
              </div>
              <div className="estado-cuenta">
                <Fila titulo="Plata que entró" sub="Ventas cobradas y abonos de fiados" derecha={colones(entro)} />
                <Fila titulo="Plata que salió" sub="Compras y gastos pagados" derecha={'−' + colones(salio)} />
                <Fila titulo={<strong>Flujo de caja</strong>} derecha={<strong className={entro - salio >= 0 ? 'verde' : 'rojo'}>{colones(entro - salio)}</strong>} />
              </div>
              <p className="tenue pad">El resultado cuenta las ventas del mes aunque no se hayan cobrado; el flujo de caja cuenta solo la plata que realmente entró o salió.</p>
            </Seccion>

            {hoja === 'traslado' && <Traslado onCerrar={() => setHoja(null)} onListo={() => { setHoja(null); carga.recargar() }} />}
            {hoja === 'cuadre' && <Cuadre saldos={d.saldos} onCerrar={() => setHoja(null)} onListo={() => { setHoja(null); carga.recargar() }} />}
            {hoja === 'consumo' && <NuevoConsumo onCerrar={() => setHoja(null)} onListo={() => { setHoja(null); carga.recargar() }} />}
          </>
        )
      })()}
    </Estado>
  )
}

function Traslado({ onCerrar, onListo }) {
  const [de, setDe] = useState('efectivo')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()
  const a = de === 'efectivo' ? 'banco' : 'efectivo'
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('traslado', { p_monto: Number(monto), p_de: de, p_a: a, p_nota: nota || null }), 'Traslado registrado')) onListo()
  }
  return (
    <Hoja abierta titulo="Traslado entre cuentas" onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Segmento opciones={[['efectivo', 'Efectivo → Banco'], ['banco', 'Banco → Efectivo']]} valor={de} onChange={setDe} />
        <Campo label="Monto (₡)"><input type="number" inputMode="numeric" required min="1" value={monto} onChange={(e) => setMonto(num(e.target.value))} /></Campo>
        <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={de === 'efectivo' ? 'Depósito de la caja de la ASOdita' : 'Retiro para cambio'} /></Campo>
        <Boton variante="pri" disabled={ocupado}>Registrar traslado</Boton>
      </form>
    </Hoja>
  )
}

function Cuadre({ saldos, onCerrar, onListo }) {
  const [cuenta, setCuenta] = useState('efectivo')
  const [real, setReal] = useState('')
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()
  const dif = real === '' ? null : Number(real) - saldos[cuenta]
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('ajuste_caja', { p_cuenta: cuenta, p_saldo_real: Number(real), p_nota: nota || null }), 'Caja cuadrada')) onListo()
  }
  return (
    <Hoja abierta titulo="Cuadrar caja" onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <p className="tenue">Contá lo que hay realmente. Si no coincide con el sistema, la diferencia queda registrada como ajuste.</p>
        <Cuenta valor={cuenta} onChange={setCuenta} />
        <p>Según el sistema: <b className="num">{colones(saldos[cuenta])}</b></p>
        <Campo label="Lo que hay realmente (₡)" ayuda={dif == null ? null : dif === 0 ? 'Cuadra exacto.' : `Diferencia: ${dif > 0 ? 'sobran' : 'faltan'} ${colones(Math.abs(dif))}`}>
          <input type="number" inputMode="numeric" required value={real} onChange={(e) => setReal(num(e.target.value))} />
        </Campo>
        <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Cierre de caja del viernes" /></Campo>
        <Boton variante="pri" disabled={ocupado || dif === 0}>Guardar cuadre</Boton>
      </form>
    </Hoja>
  )
}

// ---------------- Consumo propio ----------------
const MOTIVOS = { consumo: 'Consumo propio', merma: 'Merma', donacion: 'Donación', conteo: 'Conteo físico' }

function Consumo({ mes }) {
  const nombre = useNombres()
  const [nuevo, setNuevo] = useState(false)
  const [motivo, setMotivo] = useState('consumo')
  const carga = useCarga(async () => {
    const [ajustes, productos, eventos] = await Promise.all([
      api.list('ajustes_stock', { filtros: [['gte', 'fecha', mes.toISOString()], ['lt', 'fecha', finMes(mes).toISOString()]], orden: ['fecha', false] }),
      api.list('productos'),
      api.list('eventos'),
    ])
    return { ajustes, productos: new Map(productos.map((p) => [p.id, p])), eventos: new Map(eventos.map((e) => [e.id, e])) }
  }, [mes.getTime()])
  const d = carga.data
  const lista = (d?.ajustes || []).filter((a) => a.cantidad < 0 && (motivo === 'todos' || a.motivo === motivo))
  const total = sumar(lista, (a) => -a.cantidad * a.costo)
  const exportar = () => descargarCSV(`consumo-${isoDia(mes).slice(0, 7)}.csv`, lista.map((a) => ({
    fecha: new Date(a.fecha).toLocaleString('es-CR'), motivo: MOTIVOS[a.motivo] || a.motivo,
    producto: d.productos.get(a.producto_id) ? nombreProducto(d.productos.get(a.producto_id)) : '', unidades: -a.cantidad,
    costo_unitario: a.costo, total: -a.cantidad * a.costo, evento: d.eventos.get(a.evento_id)?.nombre || '', nota: a.nota || '', registro: nombre(a.creado_por),
  })))

  return (
    <>
      <div className="en-linea fin">
        {lista.length > 0 && <Boton onClick={exportar}><Download size={16} /> CSV</Boton>}
        <Boton variante="pri" onClick={() => setNuevo(true)}><Plus size={18} /> Consumo</Boton>
      </div>
      <Chips opciones={[['consumo', 'Consumo propio'], ['merma', 'Merma'], ['donacion', 'Donaciones'], ['todos', 'Todo']]} valor={motivo} onChange={setMotivo} />
      <Estado carga={carga}>
        {d && (
          <>
            <div className="resumen-linea"><span>{sumar(lista, (a) => -a.cantidad)} unidades · al costo</span><strong className="num">{colones(total)}</strong></div>
            {lista.length ? (
              <Lista>
                {lista.map((a) => {
                  const p = d.productos.get(a.producto_id)
                  return (
                    <Fila key={a.id}
                      titulo={<>{p ? nombreProducto(p) : 'Producto'} {motivo === 'todos' && <Etiqueta>{MOTIVOS[a.motivo] || a.motivo}</Etiqueta>}</>}
                      sub={[`${fechaCorta(a.fecha)} ${hora(a.fecha)}`, a.nota, d.eventos.get(a.evento_id)?.nombre, a.creado_por && nombre(a.creado_por)].filter(Boolean).join(' · ')}
                      derecha={colones(-a.cantidad * a.costo)} derechaSub={`${-a.cantidad} u × ${colones(a.costo)}`} />
                  )
                })}
              </Lista>
            ) : <Vacio>No hay {motivo === 'todos' ? 'salidas de inventario' : (MOTIVOS[motivo] || '').toLowerCase()} registrado en {nombreMes(mes)}.</Vacio>}
            <p className="tenue pad">Se cuenta al costo del producto y se resta del resultado del mes. El stock baja de la bodega.</p>
          </>
        )}
      </Estado>
      {nuevo && <NuevoConsumo onCerrar={() => setNuevo(false)} onListo={() => { setNuevo(false); carga.recargar() }} />}
    </>
  )
}

function NuevoConsumo({ onCerrar, onListo }) {
  const [correr, ocupado] = useAccion()
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('consumo')
  const [eventoId, setEventoId] = useState('')
  const [nota, setNota] = useState('')
  const carga = useCarga(async () => {
    const [productos, existencias, eventos] = await Promise.all([
      api.list('productos', { filtros: [['eq', 'activo', true], ['eq', 'es_servicio', false]], orden: ['nombre'] }),
      api.list('existencias').catch(() => []),
      api.list('eventos', { filtros: [['neq', 'estado', 'cerrado']], orden: ['fecha'] }),
    ])
    const manos = new Map()
    ;(existencias || []).forEach((e) => manos.set(e.producto_id, (manos.get(e.producto_id) || 0) + Number(e.cantidad)))
    productos.forEach((p) => { p.bodega = p.stock - (manos.get(p.id) || 0) })
    return { productos, eventos }
  })
  const p = carga.data?.productos.find((x) => x.id === productoId)
  const n = Number(cantidad) || 0
  const pasa = p && n > p.bodega

  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('ajustar_stock', { p_producto: productoId, p_cantidad: -n, p_motivo: motivo, p_nota: nota || null, p_evento: eventoId || null }),
      `${MOTIVOS[motivo]} registrado: ${n} × ${nombreProducto(p)}`)) onListo()
  }

  return (
    <Hoja abierta titulo="Consumo propio" onCerrar={onCerrar}>
      <Estado carga={carga}>
        {carga.data && (
          <form className="form" onSubmit={guardar}>
            <p className="tenue">Para producto que usa la asociación sin venderlo: café para la junta, agua para jurados, premios… Baja el stock de la bodega y se cuenta al costo en Finanzas.</p>
            <Campo label="Producto">
              <select required value={productoId} onChange={(e) => setProductoId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Elegí un producto</option>
                {carga.data.productos.map((x) => <option key={x.id} value={x.id}>{nombreProducto(x)} · {x.bodega} en bodega</option>)}
              </select>
            </Campo>
            <div className="dos-col">
              <Campo label="Unidades" ayuda={p && n > 0 && !pasa ? `Al costo: ${colones(n * p.costo)}` : null}>
                <input type="number" inputMode="numeric" required min="1" value={cantidad} onChange={(e) => setCantidad(num(e.target.value))} />
              </Campo>
              <Campo label="Evento (opcional)">
                <select value={eventoId} onChange={(e) => setEventoId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Ninguno</option>
                  {carga.data.eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
                </select>
              </Campo>
            </div>
            {pasa && <p className="aviso-linea">En bodega solo hay {p.bodega}. Si lo tiene un vendedor, primero devolvelo a bodega en Inventario.</p>}
            <Campo label="Tipo" grupo><Segmento opciones={[['consumo', 'Consumo propio'], ['merma', 'Merma'], ['donacion', 'Donación']]} valor={motivo} onChange={setMotivo} /></Campo>
            <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: café para la reunión de junta" /></Campo>
            <Boton variante="pri" disabled={ocupado || !productoId || n <= 0 || pasa}>Registrar</Boton>
          </form>
        )}
      </Estado>
    </Hoja>
  )
}

// ---------------- Gastos ----------------
function Gastos({ mes }) {
  const [nuevo, setNuevo] = useState(false)
  const [viendo, setViendo] = useState(null)
  const [cat, setCat] = useState('todas')
  const carga = useCarga(async () => {
    const [gastos, eventos, proveedores] = await Promise.all([
      api.list('gastos', { filtros: [['gte', 'fecha', isoDia(mes)], ['lt', 'fecha', isoDia(finMes(mes))]], orden: ['fecha', false] }),
      api.list('eventos'),
      api.list('proveedores', { orden: ['nombre'] }),
    ])
    return { gastos, eventos, proveedores }
  }, [mes.getTime()])
  const d = carga.data
  const lista = (d?.gastos || []).filter((g) => cat === 'todas' || (cat === 'pendientes' ? !g.pagado && !g.anulado : g.categoria === cat))
  const activos = lista.filter((g) => !g.anulado)
  const cats = [...new Set((d?.gastos || []).map((g) => g.categoria))]
  const exportar = () => descargarCSV(`gastos-${isoDia(mes).slice(0, 7)}.csv`, lista.map((g) => ({
    fecha: g.fecha, categoria: g.categoria, descripcion: g.descripcion, monto: g.monto, pagado: g.pagado ? 'sí' : 'no', cuenta: g.cuenta || '', anulado: g.anulado ? 'sí' : '',
    evento: d.eventos.find((e) => e.id === g.evento_id)?.nombre || '', registro: g.creado_por || '',
  })))

  return (
    <>
      <div className="en-linea fin">
        {lista.length > 0 && <Boton onClick={exportar}><Download size={16} /> CSV</Boton>}
        <Boton variante="pri" onClick={() => setNuevo(true)}><Plus size={18} /> Gasto</Boton>
      </div>
      <Chips opciones={[['todas', 'Todos'], ['pendientes', 'Sin pagar'], ...cats.map((c) => [c, c])]} valor={cat} onChange={setCat} />
      <Estado carga={carga}>
        {d && (
          <>
            <div className="resumen-linea"><span>{activos.length} gastos</span><strong className="num">{colones(sumar(activos, 'monto'))}</strong></div>
            {lista.length ? (
              <Lista>
                {lista.map((g) => (
                  <Fila key={g.id} onClick={() => setViendo(g)}
                    titulo={<>{g.descripcion} {!g.pagado && !g.anulado && <Etiqueta tono="rojo">Sin pagar</Etiqueta>}{g.anulado && <Etiqueta>Anulado</Etiqueta>}</>}
                    sub={`${fechaCorta(g.fecha)} · ${g.categoria}${g.evento_id ? ' · ' + (d.eventos.find((e) => e.id === g.evento_id)?.nombre || '') : ''}`}
                    derecha={colones(g.monto)} derechaSub={g.cuenta || null} />
                ))}
              </Lista>
            ) : <Vacio>No hay gastos registrados en {nombreMes(mes)}.</Vacio>}
          </>
        )}
      </Estado>
      {nuevo && d && <NuevoGasto d={d} onCerrar={() => setNuevo(false)} onListo={() => { setNuevo(false); carga.recargar() }} />}
      {viendo && <DetalleGasto gasto={viendo} onCerrar={() => setViendo(null)} onListo={() => { setViendo(null); carga.recargar() }} />}
    </>
  )
}

function NuevoGasto({ d, onCerrar, onListo }) {
  const [f, setF] = useState({ fecha: isoDia(), categoria: CATEGORIAS_GASTO[0], descripcion: '', monto: '', pagado: true, cuenta: 'efectivo', evento_id: '', proveedor_id: '' })
  const [correr, ocupado] = useAccion()
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('registrar_gasto', { p: { ...f, monto: Number(f.monto), evento_id: f.evento_id || null, proveedor_id: f.proveedor_id || null } }), 'Gasto registrado')) onListo()
  }
  return (
    <Hoja abierta titulo="Nuevo gasto" onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Campo label="Descripción"><input required autoFocus value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Vasos y servilletas" /></Campo>
        <div className="dos-col">
          <Campo label="Monto (₡)"><input type="number" inputMode="numeric" required min="1" value={f.monto} onChange={(e) => setF({ ...f, monto: num(e.target.value) })} /></Campo>
          <Campo label="Fecha"><input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
        </div>
        <Campo label="Categoría" grupo><Chips opciones={CATEGORIAS_GASTO.map((c) => [c, c])} valor={f.categoria} onChange={(categoria) => setF({ ...f, categoria })} /></Campo>
        <div className="dos-col">
          <Campo label="Evento (opcional)">
            <select value={f.evento_id} onChange={(e) => setF({ ...f, evento_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Ninguno</option>
              {d.eventos.filter((e) => e.estado !== 'cerrado').map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Proveedor (opcional)">
            <select value={f.proveedor_id} onChange={(e) => setF({ ...f, proveedor_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Ninguno</option>
              {d.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="¿Ya se pagó?" grupo><Segmento opciones={[['si', 'Sí, ya se pagó'], ['no', 'Queda pendiente']]} valor={f.pagado ? 'si' : 'no'} onChange={(v) => setF({ ...f, pagado: v === 'si' })} /></Campo>
        {f.pagado && <Cuenta valor={f.cuenta} onChange={(cuenta) => setF({ ...f, cuenta })} />}
        <Boton variante="pri" disabled={ocupado}>Registrar gasto</Boton>
      </form>
    </Hoja>
  )
}

function DetalleGasto({ gasto, onCerrar, onListo }) {
  const nombre = useNombres()
  const [cuenta, setCuenta] = useState('efectivo')
  const [confirmar, setConfirmar] = useState(false)
  const [correr, ocupado] = useAccion()
  return (
    <Hoja abierta titulo={gasto.descripcion} onCerrar={onCerrar}>
      <Lista>
        <Fila titulo="Monto" derecha={colones(gasto.monto)} />
        <Fila titulo="Fecha" derecha={fechaCorta(gasto.fecha)} />
        <Fila titulo="Categoría" derecha={gasto.categoria} />
        <Fila titulo="Estado" derecha={gasto.anulado ? 'Anulado' : gasto.pagado ? `Pagado con ${gasto.cuenta}` : 'Sin pagar'} />
        {gasto.creado_por && <Fila titulo="Registró" derecha={nombre(gasto.creado_por)} />}
      </Lista>
      {!gasto.pagado && !gasto.anulado && (
        <div className="bloque">
          <h3>Pagar este gasto</h3>
          <Cuenta valor={cuenta} onChange={setCuenta} />
          <Boton variante="pri" disabled={ocupado} onClick={async () => { if (await correr(() => api.rpc('pagar_gasto', { p_gasto: gasto.id, p_cuenta: cuenta }), 'Gasto pagado')) onListo() }}>Registrar pago</Boton>
        </div>
      )}
      {!gasto.anulado && (confirmar ? (
        <div className="bloque bloque-peligro">
          <p>{gasto.pagado ? `Se devuelven ${colones(gasto.monto)} a ${gasto.cuenta}.` : 'El gasto deja de contar.'} No se puede deshacer.</p>
          <div className="en-linea">
            <Boton variante="peligro" disabled={ocupado} onClick={async () => { if (await correr(() => api.rpc('anular_gasto', { p_gasto: gasto.id }), 'Gasto anulado')) onListo() }}>Anular gasto</Boton>
            <Boton onClick={() => setConfirmar(false)}>Cancelar</Boton>
          </div>
        </div>
      ) : <button className="enlace peligro" onClick={() => setConfirmar(true)}>Anular este gasto</button>)}
    </Hoja>
  )
}

// ---------------- Caja ----------------
const TIPOS = { venta: 'Venta', cobro: 'Cobro de fiado', compra: 'Compra', gasto: 'Gasto', traslado: 'Traslado', ajuste: 'Ajuste de caja', anulacion: 'Anulación' }

function Caja({ mes }) {
  const [cuenta, setCuenta] = useState('todas')
  const carga = useCarga(() => api.list('movimientos', { filtros: [['gte', 'fecha', mes.toISOString()], ['lt', 'fecha', finMes(mes).toISOString()]], orden: ['fecha', false] }), [mes.getTime()])
  const lista = (carga.data || []).filter((m) => cuenta === 'todas' || m.cuenta === cuenta)
  const entra = sumar(lista.filter((m) => m.monto > 0), 'monto')
  const sale = -sumar(lista.filter((m) => m.monto < 0), 'monto')
  const exportar = () => descargarCSV(`caja-${isoDia(mes).slice(0, 7)}.csv`, lista.map((m) => ({
    fecha: new Date(m.fecha).toLocaleString('es-CR'), cuenta: m.cuenta, tipo: TIPOS[m.tipo] || m.tipo, detalle: m.nota || '', monto: m.monto, registro: m.creado_por || '',
  })))
  return (
    <>
      <div className="en-linea fin">
        <Chips opciones={[['todas', 'Todas'], ['efectivo', 'Efectivo'], ['banco', 'Banco']]} valor={cuenta} onChange={setCuenta} />
        {lista.length > 0 && <Boton onClick={exportar}><Download size={16} /> CSV</Boton>}
      </div>
      <Estado carga={carga}>
        <div className="mosaico mosaico-2">
          <div className="dato"><span className="dato-label">Entró</span><span className="dato-cifra num verde">{colones(entra)}</span></div>
          <div className="dato"><span className="dato-label">Salió</span><span className="dato-cifra num rojo">{colones(sale)}</span></div>
        </div>
        {lista.length ? (
          <Lista>
            {lista.map((m) => (
              <Fila key={m.id} titulo={m.nota || TIPOS[m.tipo]} sub={`${fechaCorta(m.fecha)} ${hora(m.fecha)} · ${TIPOS[m.tipo] || m.tipo} · ${m.cuenta}`}
                derecha={<span className={m.monto >= 0 ? 'verde' : ''}>{m.monto > 0 ? '+' : ''}{colones(m.monto)}</span>} />
            ))}
          </Lista>
        ) : <Vacio>No hubo movimientos de dinero en {nombreMes(mes)}.</Vacio>}
      </Estado>
    </>
  )
}
