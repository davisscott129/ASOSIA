import { useState } from 'react'
import { Fingerprint, KeyRound, Check } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useAccion, Pagina, Campo, Boton } from '../ui'
import { ROLES } from '../lib/format'

export default function Cuenta() {
  const { perfil, usuario, salir, refrescar } = useAuth()
  const meta = usuario?.meta || {}
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [correr, ocupado] = useAccion()

  const guardarClave = async (e) => {
    e.preventDefault()
    if (clave.length < 8) return correr(() => Promise.reject(new Error('La contraseña debe tener al menos 8 caracteres.')))
    if (clave !== clave2) return correr(() => Promise.reject(new Error('Las dos contraseñas no coinciden.')))
    if (await correr(() => api.crearClave(clave), meta.clave_lista ? 'Contraseña cambiada' : 'Contraseña creada')) {
      setClave(''); setClave2(''); refrescar()
    }
  }
  const activar = async () => {
    if (await correr(() => api.activarPasskey(), 'Face ID o huella activado en este dispositivo')) refrescar()
  }

  return (
    <Pagina titulo="Mi cuenta" atras="/mas">
      <p className="tenue pad">{perfil.nombre ? `${perfil.nombre} · ` : ''}{perfil.email} · {ROLES[perfil.rol]}</p>

      <form className="bloque" onSubmit={guardarClave}>
        <h3 className="con-icono"><KeyRound size={18} /> {meta.clave_lista ? 'Cambiar contraseña' : 'Crear contraseña'} {meta.clave_lista && <Check size={16} className="verde" />}</h3>
        <p className="tenue">Con contraseña entrás sin esperar un correo. El celular te ofrece guardarla y llenarla con Face ID o huella.</p>
        <input type="email" name="username" autoComplete="username" value={perfil.email} readOnly hidden />
        <Campo label="Contraseña nueva" ayuda="Mínimo 8 caracteres">
          <input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} minLength={8} required />
        </Campo>
        <Campo label="Repetila">
          <input type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} minLength={8} required />
        </Campo>
        <Boton variante="pri" disabled={ocupado}>{meta.clave_lista ? 'Cambiar contraseña' : 'Crear contraseña'}</Boton>
      </form>

      <div className="bloque">
        <h3 className="con-icono"><Fingerprint size={18} /> Face ID o huella {meta.passkey_lista && <Check size={16} className="verde" />}</h3>
        {api.soportaPasskey ? (
          <>
            <p className="tenue">Activalo en cada celular o compu que usés. La próxima vez tocás "Entrar con Face ID o huella" y listo, sin correo ni contraseña.</p>
            <Boton variante={meta.passkey_lista ? 'sec' : 'pri'} disabled={ocupado} onClick={activar}>
              <Fingerprint size={18} /> {meta.passkey_lista ? 'Activar también en este dispositivo' : 'Activar en este dispositivo'}
            </Boton>
          </>
        ) : <p className="tenue">Este navegador no permite Face ID ni huella. Probá desde Chrome o Safari actualizados.</p>}
      </div>

      <Boton onClick={salir}>Salir de la cuenta</Boton>
    </Pagina>
  )
}
