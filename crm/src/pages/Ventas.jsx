import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Chips, MesNav, Lista, Fila, Hoja, Campo, Boton, Cuenta, Etiqueta, Vacio, DatosSinpe, num } from '../ui'
import { colones, inicioMes, finMes, fechaCorta, hora, sumar, CANALES, descargarCSV } from '../lib/format'
import { useNombres } from '../lib/nombres'

export default function Ventas() {
  const [params, setParams] = useSearchParams()
  const filtro = params.get('f') || 'todas'
  const [mes, setMes] = useState(inicioMes())
  const [abierta, setAbierta] = useState(null)
  const [quien, setQuien] = useState('')
  const nombre = useNombres()

  const carga = useCarga(async () => {
    const filtros = filtro === 'fiados'
      ? [['eq', 'estado', 'pendiente']]
      : [['gte', 'fecha', mes.toISOString()], ['lt', 'fecha', finMes(mes).toISOString()]]
    const [ventas, clientes, eventos] = await Promise.all([
      api.list('ventas', { select: '*, venta_items(*)', filtros, orden: ['fecha', false] }),
      api.list('clientes'),
      api.list('eventos'),
    ])
    return { ventas, clientes: new Map(clientes.map((c) => [c.id, c])), eventos: new Map(eventos.map((e) => [e.id, e])) }
  }, [filtro, mes.getTime()])

  const ventas = (carga.data?.ventas || []).filter((v) =>
    filtro === 'todas' ? v.estado !== 'anulada'
      : filtro === 'anuladas' ? v.estado === 'anulada'
        : filtro === 'fiados' ? true
          : v.canal === filtro && v.estado !== 'anulada')
    .filter((v) => !quien || v.vendedor_email === quien)
  const vendedores = [...new Set((carga.data?.ventas || []).map((v) => v.vendedor_email).filter(Boolean))]

  const exportar = () => descargarCSV(`ventas-${mes.toISOString().slice(0, 7)}.csv`, ventas.map((v) => ({
    venta: v.id, fecha: new Date(v.fecha).toLocaleString('es-CR'), canal: CANALES[v.canal],
    evento: carga.data.eventos.get(v.evento_id)?.nombre || '', cliente: carga.data.clientes.get(v.cliente_id)?.nombre || '',
    productos: v.venta_items.map((i) => `${i.cantidad}x ${i.nombre}`).join('; '),
    total: v.total, pagado: v.pagado, estado: v.estado, vendedor: nombre(v.vendedor_email),
  })))

  return (
    <Pagina titulo="Ventas" acciones={ventas.length > 0 && <button className="icono-btn" onClick={exportar} aria-label="Exportar CSV" title="Exportar a Excel (CSV)"><Download size={20} /></button>}>
      <Chips
        opciones={[['todas', 'Todas'], ['fiados', 'Fiados'], ['asodita', 'ASOdita'], ['general', 'General'], ['evento', 'Eventos'], ['anuladas', 'Anuladas']]}
        valor={filtro} onChange={(f) => setParams(f === 'todas' ? {} : { f })}
      />
      {filtro !== 'fiados' && <MesNav mes={mes} onChange={setMes} />}
      {vendedores.length > 1 && (
        <select className="filtro-quien" aria-label="Filtrar por quién vendió" value={quien} onChange={(e) => setQuien(e.target.value)}>
          <option value="">Vendido por: todos</option>
          {vendedores.map((e) => <option key={e} value={e}>{nombre(e)}</option>)}
        </select>
      )}
      <Estado carga={carga}>
        {carga.data && (
          <>
            <div className="resumen-linea">
              <span>{ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'}</span>
              <strong className="num">{filtro === 'fiados' ? `Por cobrar ${colones(sumar(ventas, (v) => v.total - v.pagado))}` : colones(sumar(ventas, 'total'))}</strong>
            </div>
            {ventas.length ? (
              <Lista>
                {ventas.map((v) => (
                  <Fila
                    key={v.id} onClick={() => setAbierta(v)}
                    titulo={<>{carga.data.clientes.get(v.cliente_id)?.nombre || `Venta #${v.id}`} {v.estado === 'pendiente' && <Etiqueta tono="rojo">Fiado</Etiqueta>}{v.estado === 'anulada' && <Etiqueta>Anulada</Etiqueta>}</>}
                    sub={`#${v.id} · ${fechaCorta(v.fecha)} ${hora(v.fecha)} · ${v.canal === 'evento' ? carga.data.eventos.get(v.evento_id)?.nombre || 'Evento' : CANALES[v.canal]}${v.vendedor_email ? ' · ' + nombre(v.vendedor_email) : ''}`}
                    derecha={colones(v.total)}
                    derechaSub={v.estado === 'pendiente' ? `debe ${colones(v.total - v.pagado)}` : null}
                  />
                ))}
              </Lista>
            ) : <Vacio>{filtro === 'fiados' ? 'No hay fiados pendientes.' : 'No hay ventas con este filtro en este mes.'}</Vacio>}
          </>
        )}
      </Estado>
      <VentaDetalle key={abierta?.id} venta={abierta} cliente={carga.data?.clientes.get(abierta?.cliente_id)} onCerrar={() => setAbierta(null)} onCambio={() => { setAbierta(null); carga.recargar() }} />
    </Pagina>
  )
}

export function VentaDetalle({ venta, cliente, onCerrar, onCambio }) {
  const { esStaff } = useAuth()
  const nombre = useNombres()
  const [correr, ocupado] = useAccion()
  const [monto, setMonto] = useState('')
  const [cuenta, setCuenta] = useState('efectivo')
  const [confirmar, setConfirmar] = useState(false)
  if (!venta) return null
  const saldo = venta.total - venta.pagado
  const items = venta.venta_items || []

  const cobrar = async () => {
    const m = Number(monto) || saldo
    if (await correr(() => api.rpc('cobrar_venta', { p_venta: venta.id, p_monto: m, p_cuenta: cuenta }), m >= saldo ? 'Fiado cobrado completo' : `Abono de ${colones(m)} registrado`)) {
      setMonto(''); onCambio()
    }
  }
  const anular = async () => {
    if (await correr(() => api.rpc('anular_venta', { p_venta: venta.id }), `Venta #${venta.id} anulada`)) { setConfirmar(false); onCambio() }
  }

  return (
    <Hoja abierta titulo={`Venta #${venta.id}`} onCerrar={() => { setConfirmar(false); onCerrar() }}>
      <p className="tenue">
        {new Date(venta.fecha).toLocaleString('es-CR', { dateStyle: 'long', timeStyle: 'short' })} · {CANALES[venta.canal]}
        {cliente && <> · {cliente.nombre}</>}
        {venta.vendedor_email && <><br />Vendió: <strong>{nombre(venta.vendedor_email)}</strong></>}
      </p>
      <Lista>
        {items.map((i) => <Fila key={i.id} titulo={i.nombre} sub={`${i.cantidad} × ${colones(i.precio)}`} derecha={colones(i.cantidad * i.precio)} />)}
        {venta.descuento > 0 && <Fila titulo="Descuento" derecha={'−' + colones(venta.descuento)} />}
        <Fila titulo={<strong>Total</strong>} derecha={<strong>{colones(venta.total)}</strong>} derechaSub={venta.estado === 'anulada' ? 'anulada' : `pagado ${colones(venta.pagado)}`} />
      </Lista>
      {venta.notas && <p className="nota">{venta.notas}</p>}

      {venta.estado === 'pendiente' && (
        <div className="bloque">
          <h3>Cobrar fiado · debe {colones(saldo)}</h3>
          <Campo label="Monto" ayuda="Dejalo vacío para cobrar todo">
            <input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(num(e.target.value))} placeholder={String(saldo)} />
          </Campo>
          <Cuenta valor={cuenta} onChange={setCuenta} />
          {cuenta === 'banco' && <DatosSinpe monto={Number(monto) || saldo} />}
          <Boton variante="pri" disabled={ocupado} onClick={cobrar}>Registrar cobro</Boton>
        </div>
      )}

      {esStaff && venta.estado !== 'anulada' && (
        confirmar ? (
          <div className="bloque bloque-peligro">
            <p>Se devuelve el stock y se revierte el dinero cobrado ({colones(venta.pagado)}). No se puede deshacer.</p>
            <div className="en-linea">
              <Boton variante="peligro" disabled={ocupado} onClick={anular}>Anular venta</Boton>
              <Boton onClick={() => setConfirmar(false)}>Cancelar</Boton>
            </div>
          </div>
        ) : <button className="enlace peligro" onClick={() => setConfirmar(true)}>Anular esta venta</button>
      )}
    </Hoja>
  )
}
