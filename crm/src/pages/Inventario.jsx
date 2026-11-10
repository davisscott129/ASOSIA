import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Chips, Lista, Fila, Hoja, Campo, Boton, Segmento, Vacio, num } from '../ui'
import { colones, nombreProducto, sumar } from '../lib/format'

export default function Inventario() {
  const { esStaff } = useAuth()
  const [params, setParams] = useSearchParams()
  const filtro = params.get('f') || 'todo'
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)
  const [ajustando, setAjustando] = useState(null)
  const carga = useCarga(() => api.list('productos', { orden: ['nombre'] }))

  const t = buscar.trim().toLowerCase()
  const todos = carga.data || []
  const lista = todos.filter((p) =>
    (filtro === 'inactivos' ? !p.activo : p.activo) &&
    (filtro !== 'bajo' || (!p.es_servicio && p.stock <= p.stock_minimo)) &&
    (filtro !== 'servicios' || p.es_servicio) &&
    (filtro !== 'asodita' || p.en_asodita) &&
    (!t || nombreProducto(p).toLowerCase().includes(t) || p.categoria.toLowerCase().includes(t)))
  const valor = sumar(todos.filter((p) => p.activo && !p.es_servicio && p.stock > 0), (p) => p.stock * p.costo)

  return (
    <Pagina titulo="Inventario" atras="/mas" acciones={esStaff && <Boton variante="pri" onClick={() => setEditando({})}><Plus size={18} /> Nuevo</Boton>}>
      <div className="buscador">
        <Search size={18} />
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar producto o categoría" aria-label="Buscar producto" />
      </div>
      <Chips opciones={[['todo', 'Todo'], ['bajo', 'Stock bajo'], ['asodita', 'ASOdita'], ['servicios', 'Servicios'], ['inactivos', 'Ocultos']]} valor={filtro} onChange={(f) => setParams(f === 'todo' ? {} : { f })} />
      {esStaff && <div className="resumen-linea"><span>Inventario valorado al costo</span><strong className="num">{colones(valor)}</strong></div>}
      <Estado carga={carga}>
        {lista.length ? (
          <Lista>
            {lista.map((p) => (
              <Fila key={p.id} onClick={esStaff ? () => setEditando(p) : null}
                titulo={nombreProducto(p)}
                sub={`${p.categoria} · ${colones(p.precio)}${esStaff && !p.es_servicio ? ` · costo ${colones(p.costo)}` : ''}`}
                derecha={p.es_servicio ? 'servicio' : `${p.stock} u`}
                derechaSub={!p.es_servicio && p.stock <= p.stock_minimo ? 'reponer' : null}
                tono={!p.es_servicio && p.stock <= p.stock_minimo ? 'alerta' : null} />
            ))}
          </Lista>
        ) : carga.data && <Vacio>{todos.length ? 'Ningún producto coincide.' : 'Agregá el primer producto con el botón Nuevo.'}</Vacio>}
      </Estado>
      {editando && (
        <EditarProducto producto={editando} categorias={[...new Set(todos.map((p) => p.categoria))]} onCerrar={() => setEditando(null)}
          onAjustar={() => { setAjustando(editando); setEditando(null) }} onListo={() => { setEditando(null); carga.recargar() }} />
      )}
      {ajustando && <AjustarStock producto={ajustando} onCerrar={() => setAjustando(null)} onListo={() => { setAjustando(null); carga.recargar() }} />}
    </Pagina>
  )
}

function EditarProducto({ producto, categorias, onCerrar, onAjustar, onListo }) {
  const [f, setF] = useState({ nombre: '', variante: '', categoria: '', precio: '', costo: '', stock: '', stock_minimo: '', es_servicio: false, en_asodita: true, visible_web: false, activo: true, ...producto })
  const [correr, ocupado] = useAccion()
  const set = (k, n) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : n ? num(e.target.value) : e.target.value })
  const nuevo = !f.id

  const guardar = async (e) => {
    e.preventDefault()
    const datos = {
      nombre: f.nombre.trim(), variante: f.variante?.trim() || null, categoria: f.categoria.trim() || 'General',
      precio: Number(f.precio) || 0, costo: Number(f.costo) || 0, stock_minimo: Number(f.stock_minimo) || 0,
      es_servicio: f.es_servicio, en_asodita: f.en_asodita, visible_web: f.visible_web, activo: f.activo,
    }
    if (nuevo) datos.stock = f.es_servicio ? 0 : Number(f.stock) || 0
    if (await correr(() => (nuevo ? api.insertar('productos', datos) : api.actualizar('productos', f.id, datos)), nuevo ? 'Producto agregado' : 'Producto actualizado')) onListo()
  }

  return (
    <Hoja abierta titulo={nuevo ? 'Nuevo producto' : nombreProducto(producto)} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <div className="dos-col">
          <Campo label="Nombre"><input required value={f.nombre} onChange={set('nombre')} placeholder="Empanada" /></Campo>
          <Campo label="Variante"><input value={f.variante || ''} onChange={set('variante')} placeholder="pollo, talla M…" /></Campo>
        </div>
        <Campo label="Categoría">
          <input list="categorias" required value={f.categoria} onChange={set('categoria')} placeholder="Comida, Bebidas, Mercadería…" />
          <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
        <div className="dos-col">
          <Campo label="Precio de venta (₡)"><input type="number" inputMode="numeric" required value={f.precio} onChange={set('precio', 1)} /></Campo>
          <Campo label="Costo (₡)" ayuda={nuevo ? null : 'Se recalcula con cada compra'}><input type="number" inputMode="numeric" value={f.costo} onChange={set('costo', 1)} /></Campo>
        </div>
        {!f.es_servicio && (
          <div className="dos-col">
            {nuevo
              ? <Campo label="Stock inicial"><input type="number" inputMode="numeric" value={f.stock} onChange={set('stock', 1)} /></Campo>
              : <Campo label="Stock actual" grupo><div className="en-linea"><strong className="num grande">{producto.stock} u</strong><Boton type="button" onClick={onAjustar}>Ajustar</Boton></div></Campo>}
            <Campo label="Avisar cuando queden"><input type="number" inputMode="numeric" value={f.stock_minimo} onChange={set('stock_minimo', 1)} /></Campo>
          </div>
        )}
        {f.precio > 0 && f.costo > 0 && <p className="tenue">Margen: {colones(f.precio - f.costo)} por unidad ({Math.round((1 - f.costo / f.precio) * 100)}%)</p>}
        <div className="checks">
          <label><input type="checkbox" checked={f.es_servicio} onChange={set('es_servicio')} /> Es un servicio (no lleva stock)</label>
          <label><input type="checkbox" checked={f.en_asodita} onChange={set('en_asodita')} /> Se vende en la ASOdita</label>
          <label><input type="checkbox" checked={f.visible_web} onChange={set('visible_web')} /> Mostrar en asosiaucr.com</label>
          {!nuevo && <label><input type="checkbox" checked={!f.activo} onChange={(e) => setF({ ...f, activo: !e.target.checked })} /> Ocultar (ya no se vende)</label>}
        </div>
        <Boton variante="pri" disabled={ocupado}>{nuevo ? 'Agregar producto' : 'Guardar cambios'}</Boton>
      </form>
    </Hoja>
  )
}

function AjustarStock({ producto, onCerrar, onListo }) {
  const [motivo, setMotivo] = useState('consumo')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [correr, ocupado] = useAccion()
  const delta = motivo === 'conteo' ? (Number(cantidad) || 0) - producto.stock : -(Number(cantidad) || 0)
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('ajustar_stock', { p_producto: producto.id, p_cantidad: delta, p_motivo: motivo, p_nota: nota || null }), 'Stock ajustado')) onListo()
  }
  return (
    <Hoja abierta titulo={`Ajustar stock · ${nombreProducto(producto)}`} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <p className="tenue">Hay {producto.stock} u. Para mercadería que entra por compra, usá Proveedores y compras.</p>
        <Segmento opciones={[['consumo', 'Consumo propio'], ['merma', 'Merma'], ['donacion', 'Donación'], ['conteo', 'Conteo físico']]} valor={motivo} onChange={setMotivo} />
        <Campo label={motivo === 'conteo' ? 'Unidades contadas' : 'Unidades que salen'} ayuda={cantidad !== '' ? `El stock queda en ${producto.stock + delta} u` : null}>
          <input type="number" inputMode="numeric" required min="0" value={cantidad} onChange={(e) => setCantidad(num(e.target.value))} />
        </Campo>
        <Campo label="Nota"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: agua para jurados de la feria" /></Campo>
        <Boton variante="pri" disabled={ocupado || !delta}>Guardar ajuste</Boton>
      </form>
    </Hoja>
  )
}
