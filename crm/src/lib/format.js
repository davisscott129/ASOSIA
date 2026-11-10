export const colones = (n) => {
  const v = Math.round(Number(n) || 0)
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (v < 0 ? '−₡' : '₡') + s
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

export const nombreMes = (d) => `${MESES[d.getMonth()]} ${d.getFullYear()}`
export const fechaCorta = (s) => {
  if (!s) return ''
  const d = typeof s === 'string' && s.length === 10 ? new Date(s + 'T12:00:00') : new Date(s)
  return `${d.getDate()} ${MES_CORTO[d.getMonth()]}`
}
export const hora = (s) => new Date(s).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' })

export const inicioMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
export const finMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
export const inicioDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const isoDia = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export const sumar = (arr, f) => arr.reduce((a, x) => a + (Number(typeof f === 'function' ? f(x) : x[f]) || 0), 0)

export const nombreProducto = (p) => (p.variante ? `${p.nombre} · ${p.variante}` : p.nombre)

export const CANALES = { asodita: 'ASOdita', general: 'General', evento: 'Evento' }
export const ROLES = { admin: 'Admin', manager: 'Manager', vendedor: 'Vendedor' }
export const CATEGORIAS_GASTO = ['Insumos ASOdita', 'Eventos', 'Transporte', 'Papelería', 'Servicios', 'Mantenimiento', 'Otros']

export function descargarCSV(nombre, filas) {
  if (!filas.length) return
  const cols = Object.keys(filas[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = nombre
  a.click()
}
