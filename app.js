/**
 * app.js — Sistema de Gestión de Visitas — Shopping Paris
 * v0.1 — Estructura base: Auth, roles y usuarios, catálogos (empresas, tipos de vehículo)
 *
 * React puro vía CDN + Babel standalone (sin build step).
 * Firebase compat SDK (auth + firestore), configurado en firebase-config.js.
 */

const { useState, useEffect, useCallback } = React;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function tienePermiso(perfil, permiso) {
  if (!perfil || !perfil.permisos) return false;
  return perfil.permisos.includes(permiso);
}

function iniciales(nombre) {
  if (!nombre) return "?";
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function Toast({ mensaje, onClose }) {
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [mensaje]);

  if (!mensaje) return null;
  return <div className="toast">{mensaje}</div>;
}

// ---------------------------------------------------------------------------
// Bootstrap: crea los roles semilla la primera vez que corre el sistema
// ---------------------------------------------------------------------------

async function asegurarRolesSemilla() {
  const snap = await db.collection("roles").get();
  if (!snap.empty) return;
  const batch = db.batch();
  ROLES_POR_DEFECTO.forEach((rol) => {
    const ref = db.collection("roles").doc(rol.id);
    batch.set(ref, { nombre: rol.nombre, permisos: rol.permisos });
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Pantalla: configuración inicial (solo aparece si no hay usuarios cargados)
// ---------------------------------------------------------------------------

function SetupInicial() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function crearAdmin(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCargando(true);
    try {
      // Orden importante para cumplir las reglas de seguridad:
      // 1) crear la cuenta de Auth (recién ahí existe request.auth)
      // 2) marcar config/meta y crear los roles semilla (mientras el usuario
      //    todavía no tiene su propio documento en /usuarios)
      // 3) crear el documento de usuario admin (último paso del bootstrap)
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection("config").doc("meta").set({ setupCompleto: true });
      await asegurarRolesSemilla();
      await db.collection("usuarios").doc(cred.user.uid).set({
        nombre,
        email,
        rolId: "admin",
        activo: true,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Se recarga la página en vez de solo actualizar estado: evita una
      // condición de carrera en la que el listener de Auth podría leer el
      // documento de /usuarios antes de que termine de escribirse arriba.
      window.location.reload();
    } catch (err) {
      setError(traducirErrorAuth(err));
      setCargando(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-eyebrow">Primer ingreso</div>
        <h1>Configurar administrador</h1>
        <p className="auth-sub">
          Todavía no hay usuarios cargados. Creá la cuenta de administrador para empezar
          a gestionar la sala de guías del Shopping Paris.
        </p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={crearAdmin}>
          <div className="field">
            <label>Nombre y apellido</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={cargando}>
            {cargando ? "Creando..." : "Crear administrador"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla: login
// ---------------------------------------------------------------------------

function traducirErrorAuth(err) {
  const map = {
    "auth/invalid-email": "El email no es válido.",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres."
  };
  return map[err.code] || "Ocurrió un error. Probá de nuevo.";
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function ingresar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError(traducirErrorAuth(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-eyebrow">Sala de guías</div>
        <h1>Shopping Paris</h1>
        <p className="auth-sub">Ingresá con tu cuenta para continuar.</p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={ingresar}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal genérico
// ---------------------------------------------------------------------------

function Modal({ titulo, onClose, children, footer, ancho }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined}>
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista: Panel inicial
// ---------------------------------------------------------------------------

function PanelInicio({ perfil }) {
  const [conteos, setConteos] = useState({ usuarios: null, empresas: null, vehiculos: null, visitas: null });

  useEffect(() => {
    const unsub1 = db.collection("usuarios").onSnapshot((s) =>
      setConteos((c) => ({ ...c, usuarios: s.size }))
    );
    const unsub2 = db.collection("empresas").onSnapshot((s) =>
      setConteos((c) => ({ ...c, empresas: s.size }))
    );
    const unsub3 = db.collection("tiposVehiculo").onSnapshot((s) =>
      setConteos((c) => ({ ...c, vehiculos: s.size }))
    );
    const unsub4 = db
      .collection("visitas")
      .where("estado", "==", "en_curso")
      .onSnapshot((s) => setConteos((c) => ({ ...c, visitas: s.size })));
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Panel</div>
          <h1>Hola, {perfil.nombre.split(" ")[0]}</h1>
          <p className="page-desc">Estado general del sistema.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Visitas en curso</div>
          <div className="stat-value">{conteos.visitas ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Usuarios activos</div>
          <div className="stat-value">{conteos.usuarios ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Empresas registradas</div>
          <div className="stat-value">{conteos.empresas ?? "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tipos de vehículo</div>
          <div className="stat-value">{conteos.vehiculos ?? "—"}</div>
        </div>
      </div>

      <div className="ticket">
        <div className="ticket-stub">v1.17</div>
        <div className="ticket-perforation"></div>
        <div className="ticket-body">
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>Versión estable</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 10 }}>
            Plataforma integral para la administración de guías: control de ingresos,
            liberación de estacionamiento, cierre de jornada, reportería y análisis
            de fidelización.
          </p>
          <span className="badge badge-success">✓ Sistema completo</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista: Usuarios y Roles
// ---------------------------------------------------------------------------

function UsuariosView({ mostrarToast }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [modalUsuario, setModalUsuario] = useState(null); // null | {} para nuevo | objeto para editar
  const [modalRol, setModalRol] = useState(null);
  const [tab, setTab] = useState("usuarios");

  useEffect(() => {
    const u = db.collection("usuarios").orderBy("nombre").onSnapshot((snap) =>
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const r = db.collection("roles").onSnapshot((snap) =>
      setRoles(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const t = db.collection("tiendas").orderBy("nombre").onSnapshot((snap) =>
      setTiendas(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.activo !== false))
    );
    return () => {
      u();
      r();
      t();
    };
  }, []);

  function nombreRol(rolId) {
    const r = roles.find((x) => x.id === rolId);
    return r ? r.nombre : "Sin rol";
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Administración</div>
          <h1>Usuarios y roles</h1>
          <p className="page-desc">Creá cuentas de acceso y definí qué puede hacer cada rol.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {tab === "usuarios" ? (
            <button className="btn btn-gold" onClick={() => setModalUsuario({})}>+ Nuevo usuario</button>
          ) : (
            <button className="btn btn-gold" onClick={() => setModalRol({ permisos: [] })}>+ Nuevo rol</button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button
          className={`nav-item ${tab === "usuarios" ? "active" : ""}`}
          style={{ color: tab === "usuarios" ? "var(--ink)" : "var(--text-muted)", width: "auto", background: tab === "usuarios" ? "var(--gold-soft)" : "transparent" }}
          onClick={() => setTab("usuarios")}
        >
          Usuarios
        </button>
        <button
          className={`nav-item ${tab === "roles" ? "active" : ""}`}
          style={{ color: tab === "roles" ? "var(--ink)" : "var(--text-muted)", width: "auto", background: tab === "roles" ? "var(--gold-soft)" : "transparent" }}
          onClick={() => setTab("roles")}
        >
          Roles
        </button>
      </div>

      {tab === "usuarios" ? (
        <div className="panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {usuarios.length === 0 ? (
              <div className="empty-state">
                <div className="display">Todavía no hay usuarios</div>
                <p>Creá el primero con el botón "+ Nuevo usuario".</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Tienda(s)</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="user-avatar">{iniciales(u.nombre)}</div>
                          {u.nombre}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td><span className="badge badge-gold">{nombreRol(u.rolId)}</span></td>
                      <td>
                        {(u.tiendaIds || []).length === 0 ? (
                          <span className="badge badge-muted">Sala de guías</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(u.tiendaIds || []).map((tid) => {
                              const t = tiendas.find((x) => x.id === tid);
                              return <span key={tid} className="badge badge-muted">{t ? t.nombre : "?"}</span>;
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        {u.activo ? (
                          <span className="badge badge-success">Activo</span>
                        ) : (
                          <span className="badge badge-muted">Inactivo</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="icon-btn" onClick={() => setModalUsuario(u)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {roles.length === 0 ? (
              <div className="empty-state">
                <div className="display">No hay roles cargados</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Permisos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(r.permisos || []).map((p) => (
                            <span key={p} className="badge badge-muted">
                              {(PERMISOS_DISPONIBLES.find((x) => x.id === p) || {}).label || p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="icon-btn" onClick={() => setModalRol(r)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modalUsuario && (
        <ModalUsuario
          usuario={modalUsuario}
          roles={roles}
          tiendas={tiendas}
          onClose={() => setModalUsuario(null)}
          mostrarToast={mostrarToast}
        />
      )}
      {modalRol && (
        <ModalRol rol={modalRol} onClose={() => setModalRol(null)} mostrarToast={mostrarToast} />
      )}
    </div>
  );
}

function ModalUsuario({ usuario, roles, tiendas, onClose, mostrarToast }) {
  const esNuevo = !usuario.id;
  const [nombre, setNombre] = useState(usuario.nombre || "");
  const [email, setEmail] = useState(usuario.email || "");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState(usuario.rolId || (roles[0] && roles[0].id) || "");
  const [tiendaIds, setTiendaIds] = useState(usuario.tiendaIds || []);
  const [activo, setActivo] = useState(usuario.activo !== false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function toggleTienda(id) {
    setTiendaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (esNuevo) {
        if (password.length < 6) {
          setError("La contraseña debe tener al menos 6 caracteres.");
          setCargando(false);
          return;
        }
        // Se crea la cuenta con la app secundaria para no cerrar la sesión del Admin actual.
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        await db.collection("usuarios").doc(cred.user.uid).set({
          nombre,
          email,
          rolId,
          tiendaIds,
          activo,
          creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        await secondaryAuth.signOut();
        mostrarToast("Usuario creado. Ya puede ingresar con su email y contraseña.");
      } else {
        await db.collection("usuarios").doc(usuario.id).update({ nombre, rolId, tiendaIds, activo });
        mostrarToast("Usuario actualizado.");
      }
      onClose();
    } catch (err) {
      setError(traducirErrorAuth(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo={esNuevo ? "Nuevo usuario" : "Editar usuario"}
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </React.Fragment>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre y apellido</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!esNuevo}
          />
        </div>
        {esNuevo && (
          <div className="field">
            <label>Contraseña provisoria</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label>Rol</label>
          <select value={rolId} onChange={(e) => setRolId(e.target.value)} required>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tiendas asignadas</label>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -2, marginBottom: 8 }}>
            Sin ninguna marcada, el usuario entra por "Visitas" (sala de guías). Con al menos una
            marcada, entra por "Tienda" en cambio, y no ve "Visitas".
          </p>
          {tiendas.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Todavía no hay tiendas cargadas — se pueden crear desde "Tiendas" en el menú.
            </p>
          ) : (
            <div className="checkbox-list">
              {tiendas.map((t) => (
                <div className="checkbox-row" key={t.id}>
                  <input
                    type="checkbox"
                    id={`tienda-${t.id}`}
                    checked={tiendaIds.includes(t.id)}
                    onChange={() => toggleTienda(t.id)}
                  />
                  <label htmlFor={`tienda-${t.id}`}>{t.nombre}</label>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="checkbox-row">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} id="activo" />
          <label htmlFor="activo">Usuario activo</label>
        </div>
      </form>
    </Modal>
  );
}

function ModalRol({ rol, onClose, mostrarToast }) {
  const esNuevo = !rol.id;
  const [nombre, setNombre] = useState(rol.nombre || "");
  const [permisos, setPermisos] = useState(rol.permisos || []);
  const [cargando, setCargando] = useState(false);

  function togglePermiso(id) {
    setPermisos((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function guardar(e) {
    e.preventDefault();
    setCargando(true);
    try {
      if (esNuevo) {
        const ref = db.collection("roles").doc();
        await ref.set({ nombre, permisos });
      } else {
        await db.collection("roles").doc(rol.id).update({ nombre, permisos });
      }
      mostrarToast("Rol guardado.");
      onClose();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo={esNuevo ? "Nuevo rol" : "Editar rol"}
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </React.Fragment>
      }
    >
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre del rol</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} required />
        </div>
        <div className="field">
          <label>Permisos</label>
          <div className="checkbox-list">
            {PERMISOS_DISPONIBLES.map((p) => (
              <div className="checkbox-row" key={p.id}>
                <input
                  type="checkbox"
                  id={`perm-${p.id}`}
                  checked={permisos.includes(p.id)}
                  onChange={() => togglePermiso(p.id)}
                />
                <label htmlFor={`perm-${p.id}`}>{p.label}</label>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista: Visitas (ingreso de guías a la sala)
// ---------------------------------------------------------------------------

// Convierte a un objeto Date de JS un valor de fecha que puede venir en 3
// formatos distintos: un Timestamp de Firestore "vivo" (con método .toDate),
// el mismo Timestamp ya "aplanado" a {seconds, nanoseconds} — que es lo que
// queda después de un JSON.stringify/parse, como al guardar en localStorage
// para la reimpresión — o un valor común (string, número, Date). Devuelve
// null si no se puede interpretar.
function aFechaJS(fecha) {
  if (!fecha) return null;
  if (typeof fecha.toDate === "function") return fecha.toDate();
  if (typeof fecha.seconds === "number") return new Date(fecha.seconds * 1000);
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? null : d;
}

function tiempoTranscurrido(fecha) {
  const inicio = aFechaJS(fecha);
  if (!inicio) return "—";
  const minutos = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / 60000));
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function VisitasView({ perfil, mostrarToast }) {
  const [guias, setGuias] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tiposVehiculo, setTiposVehiculo] = useState([]);
  const [visitasEnCurso, setVisitasEnCurso] = useState([]);
  const [visitaSeleccionada, setVisitaSeleccionada] = useState(null);
  const [visitaParaPermiso, setVisitaParaPermiso] = useState(null);
  const [visitaParaReingreso, setVisitaParaReingreso] = useState(null);
  const [modoPartner, setModoPartner] = useState(false);
  const [busquedaGuia, setBusquedaGuia] = useState("");
  const [mostrarCierreDia, setMostrarCierreDia] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const u1 = db.collection("guias").orderBy("nombre").onSnapshot((s) =>
      setGuias(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = db.collection("empresas").orderBy("nombre").onSnapshot((s) =>
      setEmpresas(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.activo !== false))
    );
    const u3 = db.collection("tiposVehiculo").orderBy("nombre").onSnapshot((s) =>
      setTiposVehiculo(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.activo !== false))
    );
    const u4 = db
      .collection("visitas")
      .where("estado", "==", "en_curso")
      .onSnapshot((s) =>
        setVisitasEnCurso(
          s.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.fechaHoraIngreso?.seconds || 0) - (a.fechaHoraIngreso?.seconds || 0))
        )
      );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  // Mantiene sincronizada la visita abierta en el modal con los cambios en vivo.
  useEffect(() => {
    if (!visitaSeleccionada) return;
    const actualizada = visitasEnCurso.find((v) => v.id === visitaSeleccionada.id);
    if (actualizada) setVisitaSeleccionada(actualizada);
    else setVisitaSeleccionada(null); // ya se liberó (desde otra pestaña, por ejemplo)
  }, [visitasEnCurso]);

  // Refresca el "tiempo transcurrido" de cada tarjeta cada 30 segundos.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const puedeLiberar = tienePermiso(perfil, "liberar_estacionamiento");
  const [ultimoTicket, setUltimoTicket] = useState(null);
  const [reimprimiendo, setReimprimiendo] = useState(false);

  useEffect(() => {
    setUltimoTicket(obtenerUltimoTicketLiberado());
  }, []);

  async function reimprimirUltimoTicket() {
    if (!ultimoTicket) return;
    setReimprimiendo(true);
    const ok = await imprimirComprobanteLiberacion(
      ultimoTicket.visita,
      ultimoTicket.usuarioNombre,
      ultimoTicket.visita.liberadoComoPartner,
      ultimoTicket.visita.numeroLiberacion
    );
    setReimprimiendo(false);
    mostrarToast(
      ok
        ? `Ticket reimpreso: ${ultimoTicket.visita.guiaNombre}`
        : "No se pudo reimprimir. Revisá que el servidor de impresión esté encendido."
    );
  }

  async function anularVisita(v) {
    const confirmar = window.confirm(
      `¿Anular la visita de "${v.guiaNombre}" (ticket ${v.ticketEstacionamiento})?\n\nEsto se usa solo cuando la visita se cargó por error. No se puede deshacer.`
    );
    if (!confirmar) return;
    try {
      await db.collection("visitas").doc(v.id).delete();
      mostrarToast("Visita anulada.");
    } catch (err) {
      console.error(err);
      mostrarToast("No se pudo anular la visita.");
    }
  }

  const visitasFiltradas = busquedaGuia.trim()
    ? visitasEnCurso.filter((v) => (v.guiaNombre || "").toLowerCase().includes(busquedaGuia.trim().toLowerCase()))
    : visitasEnCurso;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Sala de guías</div>
          <h1>Visitas</h1>
          <p className="page-desc">Registrá el ingreso de cada guía y su grupo al llegar a la sala.</p>
        </div>
      </div>

      <FormularioVisita
        guias={guias}
        empresas={empresas}
        tiposVehiculo={tiposVehiculo}
        perfil={perfil}
        mostrarToast={mostrarToast}
      />

      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 18, whiteSpace: "nowrap" }}>Visitas en curso</h2>
          <input
            type="text"
            value={busquedaGuia}
            onChange={(e) => setBusquedaGuia(e.target.value)}
            placeholder="Buscar por nombre de guía..."
            style={{ flex: "1 1 240px", maxWidth: 420, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <span className="badge badge-gold">{visitasEnCurso.length}</span>
            {puedeLiberar && ultimoTicket && (
              <button
                className="btn btn-ghost"
                onClick={reimprimirUltimoTicket}
                disabled={reimprimiendo}
                title={`Último ticket liberado: ${ultimoTicket.visita.guiaNombre}`}
              >
                {reimprimiendo ? "Imprimiendo..." : "🖨️ Reimprimir último ticket"}
              </button>
            )}
            {tienePermiso(perfil, "registrar_visitas") && visitasEnCurso.length > 0 && (
              <button className="btn btn-ghost" onClick={() => setMostrarCierreDia(true)}>Cerrar día</button>
            )}
          </div>
        </div>

        {visitasEnCurso.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <div className="display">No hay guías en la sala en este momento</div>
              <p>Los ingresos que registres van a aparecer acá.</p>
            </div>
          </div>
        ) : visitasFiltradas.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <div className="display">Sin resultados</div>
              <p>No hay ningún guía en curso que coincida con "{busquedaGuia}".</p>
            </div>
          </div>
        ) : (
          <div className="ticket-grid">
            {visitasFiltradas.map((v) => {
              const porcentaje = v.montoMinimoRequerido > 0
                ? Math.min(100, Math.round((v.montoAcumulado / v.montoMinimoRequerido) * 100))
                : 0;
              const alcanzado = v.montoAcumulado >= v.montoMinimoRequerido;
              return (
                <div className="ticket" key={v.id}>
                  <div className="ticket-stub">{tiempoTranscurrido(v.fechaHoraIngreso)}</div>
                  <div className="ticket-perforation"></div>
                  <div className="ticket-body">
                    <h3 style={{ fontSize: 16 }}>{v.guiaNombre}</h3>
                    {v.permisoSalida && (
                      <span className="badge badge-gold" style={{ marginBottom: 8 }}>🚗 Permiso de salida otorgado</span>
                    )}
                    <div className="ticket-meta">
                      <span><strong>Empresa:</strong> {v.empresaNombre}</span>
                      <span><strong>Vehículo:</strong> {v.vehiculoTipoNombre} · {v.chapa}</span>
                      <span><strong>Pasajeros:</strong> {v.cantPasajeros}</span>
                      <span><strong>Ticket:</strong> {v.ticketEstacionamiento}</span>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                        <span>$ {Number(v.montoAcumulado || 0).toLocaleString("es-AR")} de $ {Number(v.montoMinimoRequerido || 0).toLocaleString("es-AR")}</span>
                        <span>{porcentaje}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "var(--paper)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${porcentaje}%`,
                            background: alcanzado ? "var(--success)" : "var(--gold)",
                            transition: "width 0.2s ease"
                          }}
                        ></div>
                      </div>
                    </div>

                    {tienePermiso(perfil, "registrar_visitas") && (
                      <button
                        className="btn btn-ghost"
                        style={{ width: "100%", marginTop: 12 }}
                        onClick={() => (v.permisoSalida ? setVisitaParaReingreso(v) : setVisitaParaPermiso(v))}
                      >
                        {v.permisoSalida ? "Registrar reingreso (quitar permiso)" : "Otorgar permiso de salida"}
                      </button>
                    )}

                    {puedeLiberar && (
                      <button
                        className="btn btn-gold"
                        style={{ width: "100%", marginTop: 8 }}
                        onClick={() => {
                          setModoPartner(false);
                          setVisitaSeleccionada(v);
                        }}
                      >
                        {alcanzado ? "Liberar estacionamiento" : "Registrar compra"}
                      </button>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {puedeLiberar && !alcanzado && (
                        <button
                          className="btn btn-ghost"
                          style={{ flex: 1 }}
                          onClick={() => {
                            setModoPartner(true);
                            setVisitaSeleccionada(v);
                          }}
                          title="Liberar sin monto mínimo — solo para tiendas Partner del shopping"
                        >
                          Partner
                        </button>
                      )}
                      {tienePermiso(perfil, "registrar_visitas") && (
                        <button
                          className="btn btn-danger"
                          style={!alcanzado ? undefined : { marginLeft: "auto" }}
                          onClick={() => anularVisita(v)}
                          title="Anular esta visita (se cargó por error)"
                        >
                          ✕ Anular visita
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {visitaSeleccionada && (
        <ModalLiberarVisita
          visita={visitaSeleccionada}
          perfil={perfil}
          modoPartner={modoPartner}
          onClose={() => {
            setVisitaSeleccionada(null);
            setModoPartner(false);
            setUltimoTicket(obtenerUltimoTicketLiberado());
          }}
          mostrarToast={mostrarToast}
        />
      )}

      {visitaParaPermiso && (
        <ModalPermisoSalida
          visita={visitaParaPermiso}
          perfil={perfil}
          onClose={() => setVisitaParaPermiso(null)}
          mostrarToast={mostrarToast}
        />
      )}

      {visitaParaReingreso && (
        <ModalReingresoVisita
          visita={visitaParaReingreso}
          onClose={() => setVisitaParaReingreso(null)}
          mostrarToast={mostrarToast}
        />
      )}

      {mostrarCierreDia && (
        <ModalCierreDia
          visitas={visitasEnCurso}
          perfil={perfil}
          onClose={() => setMostrarCierreDia(false)}
          mostrarToast={mostrarToast}
        />
      )}
    </div>
  );
}

function horaActualHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function FormularioVisita({ guias, empresas, tiposVehiculo, perfil, mostrarToast }) {
  const [nombreGuia, setNombreGuia] = useState("");
  const [guiaSeleccionado, setGuiaSeleccionado] = useState(null);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [empresaId, setEmpresaId] = useState("");
  const [cantPasajeros, setCantPasajeros] = useState("");
  const [vehiculoTipoId, setVehiculoTipoId] = useState("");
  const [chapa, setChapa] = useState("");
  const [ticket, setTicket] = useState("");
  const [horaIngreso, setHoraIngreso] = useState(horaActualHHMM());
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const sugerencias =
    nombreGuia.trim().length > 0
      ? guias.filter((g) => g.nombre.toLowerCase().includes(nombreGuia.trim().toLowerCase())).slice(0, 6)
      : [];

  function elegirGuia(g) {
    setGuiaSeleccionado(g);
    setNombreGuia(g.nombre);
    setMostrarSugerencias(false);
  }

  function cambiarNombreGuia(valor) {
    setNombreGuia(valor.toUpperCase());
    setGuiaSeleccionado(null);
    setMostrarSugerencias(true);
  }

  function limpiarFormulario() {
    setNombreGuia("");
    setGuiaSeleccionado(null);
    setEmpresaId("");
    setCantPasajeros("");
    setVehiculoTipoId("");
    setChapa("");
    setTicket("");
    setHoraIngreso(horaActualHHMM());
  }

  async function registrarIngreso(e) {
    e.preventDefault();
    setError("");
    if (!nombreGuia.trim() || !empresaId || !vehiculoTipoId || !chapa.trim() || !ticket.trim() || !cantPasajeros || !horaIngreso) {
      setError("Completá todos los campos para registrar el ingreso.");
      return;
    }
    setCargando(true);
    try {
      let guiaId = guiaSeleccionado ? guiaSeleccionado.id : null;
      if (!guiaId) {
        const nuevoGuia = await db.collection("guias").add({
          nombre: nombreGuia.trim(),
          creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        guiaId = nuevoGuia.id;
      }

      const empresa = empresas.find((e) => e.id === empresaId);
      const tipoVehiculo = tiposVehiculo.find((t) => t.id === vehiculoTipoId);

      // La hora de ingreso se carga a mano (el guía puede haber entrado un
      // rato antes de que se registre en el sistema), tomando como fecha
      // "hoy" — combinamos la hora elegida con la fecha del momento en que
      // se está cargando el formulario.
      const [hh, mm] = horaIngreso.split(":").map(Number);
      const fechaHoraIngreso = new Date();
      fechaHoraIngreso.setHours(hh, mm, 0, 0);

      await db.collection("visitas").add({
        guiaId,
        guiaNombre: nombreGuia.trim(),
        empresaId,
        empresaNombre: empresa ? empresa.nombre : "",
        vehiculoTipoId,
        vehiculoTipoNombre: tipoVehiculo ? tipoVehiculo.nombre : "",
        montoMinimoRequerido: tipoVehiculo ? Number(tipoVehiculo.montoMinimoCompra) || 0 : 0,
        chapa: chapa.trim().toUpperCase(),
        cantPasajeros: Number(cantPasajeros),
        ticketEstacionamiento: ticket.trim(),
        estado: "en_curso",
        montoAcumulado: 0,
        fechaHoraIngreso: firebase.firestore.Timestamp.fromDate(fechaHoraIngreso),
        usuarioIngresoId: perfil.id,
        usuarioIngresoNombre: perfil.nombre
      });

      mostrarToast(`Ingreso registrado: ${nombreGuia.trim()}`);
      limpiarFormulario();
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el ingreso. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Nuevo ingreso</h2>
      </div>
      <div className="panel-body">
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={registrarIngreso}>
          <div className="field autocomplete">
            <label>Guía</label>
            <input
              value={nombreGuia}
              onChange={(e) => cambiarNombreGuia(e.target.value)}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
              placeholder="Nombre y apellido"
              autoComplete="off"
              required
            />
            {mostrarSugerencias && nombreGuia.trim() && (
              <div className="autocomplete-list">
                {sugerencias.map((g) => (
                  <div key={g.id} className="autocomplete-item" onMouseDown={() => elegirGuia(g)}>
                    {g.nombre}
                  </div>
                ))}
                {!sugerencias.some((g) => g.nombre.toLowerCase() === nombreGuia.trim().toLowerCase()) && (
                  <div className="autocomplete-item crear-nuevo" onMouseDown={() => setMostrarSugerencias(false)}>
                    + Crear guía nuevo: "{nombreGuia.trim()}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Cantidad de pasajeros</label>
              <input
                type="number"
                min="1"
                value={cantPasajeros}
                onChange={(e) => setCantPasajeros(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tipo de vehículo</label>
              <select value={vehiculoTipoId} onChange={(e) => setVehiculoTipoId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {tiposVehiculo.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Chapa</label>
              <input value={chapa} onChange={(e) => setChapa(e.target.value.toUpperCase())} placeholder="AB 123 CD" required />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Ticket de estacionamiento</label>
              <input
                value={ticket}
                onChange={(e) => setTicket(e.target.value.toUpperCase())}
                placeholder="Número impreso en el ticket"
                required
              />
            </div>
            <div className="field">
              <label>Hora de ingreso</label>
              <input
                type="time"
                value={horaIngreso}
                onChange={(e) => setHoraIngreso(e.target.value)}
                required
              />
            </div>
          </div>

          <button className="btn btn-primary" disabled={cargando} style={{ width: "auto", padding: "11px 24px" }}>
            {cargando ? "Registrando..." : "Registrar ingreso"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liberación de estacionamiento + PDF de ticket de salida
// ---------------------------------------------------------------------------

function formatearFechaHora(fecha) {
  const d = aFechaJS(fecha);
  if (!d) return "—";
  return d.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" });
}

// Intenta traer el logo configurado y convertirlo a base64 para incrustarlo
// en el PDF. Si falla (sin logo, sin conexión, o el bucket no tiene CORS
// habilitado para lectura), devuelve null y el PDF se genera igual sin logo.
async function obtenerLogoParaPdf() {
  try {
    const doc = await db.collection("config").doc("branding").get();
    const url = doc.exists ? doc.data().logoUrl : null;
    if (!url) return null;
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const formato = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    return { dataUrl, formato };
  } catch (err) {
    console.warn("No se pudo cargar el logo para el PDF:", err);
    return null;
  }
}

async function generarPdfPermisoSalida(visita, usuarioNombre, motivos, autorizadoPorLocal) {
  const { jsPDF } = window.jspdf;
  const ancho = 100;
  const alto = 150; // más alto que antes: entran los motivos, autorizante y las 2 firmas
  const doc = new jsPDF({ unit: "mm", format: [ancho, alto] });

  const margen = 10;
  let y = 16;

  const logo = await obtenerLogoParaPdf();

  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.formato, margen, 8, 16, 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("SHOPPING PARIS", margen + 20, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Permiso de salida de estacionamiento", margen + 20, 19);
      y = 30;
    } catch (err) {
      console.warn("No se pudo incrustar el logo en el PDF:", err);
    }
  }

  if (y === 16) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("SHOPPING PARIS", margen, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Permiso de salida de estacionamiento", margen, y);
    y += 4;
  }

  doc.setLineWidth(0.3);
  doc.line(margen, y, ancho - margen, y);
  y += 8;

  function fila(etiqueta, valor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(etiqueta, margen, y);
    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(String(valor), ancho - margen * 2);
    doc.text(lineas, margen, y + 5);
    y += 6 + (lineas.length - 1) * 4.5 + 6;
  }

  fila("Guía", visita.guiaNombre);
  fila("Empresa", visita.empresaNombre);
  fila("Vehículo / Chapa", `${visita.vehiculoTipoNombre} — ${visita.chapa}`);
  fila("N° Ticket de estacionamiento", visita.ticketEstacionamiento);
  fila("Motivo de la salida", (motivos || []).join(" / ") || "—");
  fila("Autorizado por local", autorizadoPorLocal || "—");

  doc.setLineWidth(0.3);
  doc.line(margen, y, ancho - margen, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Otorgado por: ${usuarioNombre}`, margen, y);
  y += 5;
  doc.text(`Emitido: ${new Date().toLocaleString("es-PY")}`, margen, y);

  // Espacios de firma: guía y autorizante del local.
  y += 16;
  doc.setLineWidth(0.2);
  doc.line(margen, y, ancho - margen, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Firma del guía", margen, y);

  y += 20;
  doc.line(margen, y, ancho - margen, y);
  y += 4;
  doc.text("Firma autorizante del local", margen, y);

  doc.save(`permiso-salida-${visita.ticketEstacionamiento}.pdf`);
}

const MOTIVOS_SALIDA_FIJOS = [
  "Buscar pasajero",
  "Entregar mercaderías/pedidos",
  "Asuntos administrativos",
  "Taller mecánico/mantenimiento"
];

function ModalPermisoSalida({ visita, perfil, onClose, mostrarToast }) {
  const [seleccionados, setSeleccionados] = useState({});
  const [otroMotivoTexto, setOtroMotivoTexto] = useState("");
  const [autorizadoPorLocal, setAutorizadoPorLocal] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  // Igual que en la liberación: si ya se guardó en Firestore pero falló la
  // impresión, no hay que repetir el guardado — solo reintentar imprimir.
  const [yaOtorgado, setYaOtorgado] = useState(false);
  const [motivosGuardados, setMotivosGuardados] = useState(null);
  const [autorizanteGuardado, setAutorizanteGuardado] = useState("");
  const [numeroPermiso, setNumeroPermiso] = useState(null);

  function toggleMotivo(m) {
    setSeleccionados((prev) => ({ ...prev, [m]: !prev[m] }));
  }

  async function confirmar() {
    setError("");

    const motivosFinal = MOTIVOS_SALIDA_FIJOS.filter((m) => seleccionados[m]);
    if (otroMotivoTexto.trim()) {
      motivosFinal.push(`Otro motivo: ${otroMotivoTexto.trim()}`);
    }
    if (motivosFinal.length === 0) {
      setError("Marcá al menos un motivo de salida, o completá el campo \"Otro motivo\".");
      return;
    }
    if (!autorizadoPorLocal.trim()) {
      setError('El campo "Autorizado por local" es obligatorio.');
      return;
    }

    setCargando(true);
    let numero;
    try {
      numero = await asignarNumeroSecuencial(
        "permisosSalida",
        db.collection("visitas").doc(visita.id),
        "numeroPermiso",
        {
          permisoSalida: true,
          permisoSalidaPor: perfil.nombre,
          permisoSalidaFecha: firebase.firestore.FieldValue.serverTimestamp(),
          motivosSalida: motivosFinal,
          autorizadoPorLocal: autorizadoPorLocal.trim()
        }
      );
      setMotivosGuardados(motivosFinal);
      setAutorizanteGuardado(autorizadoPorLocal.trim());
      setNumeroPermiso(numero);
      setYaOtorgado(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo otorgar el permiso de salida. Probá de nuevo.");
      setCargando(false);
      return;
    }
    await intentarImprimir(motivosFinal, autorizadoPorLocal.trim(), numero);
  }

  async function intentarImprimir(motivos, autorizante, numeroParam) {
    setCargando(true);
    setError("");
    const ok = await imprimirPermisoSalida(
      visita,
      perfil.nombre,
      motivos || motivosGuardados,
      autorizante || autorizanteGuardado,
      numeroParam || numeroPermiso
    );
    if (ok) {
      mostrarToast("Permiso de salida otorgado.");
      setCargando(false);
      onClose();
    } else {
      setError(
        "El permiso se otorgó, pero no se pudo imprimir el ticket. " +
        "Verificá que la PC de la impresora esté prendida y el servidor de impresión abierto, y volvé a intentar."
      );
      setCargando(false);
    }
  }

  return (
    <Modal titulo={`Permiso de salida — ${visita.guiaNombre}`} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}

      <div className="field">
        <label>Motivo de la salida</label>
        <div className="checkbox-list">
          {MOTIVOS_SALIDA_FIJOS.map((m) => (
            <div className="checkbox-row" key={m}>
              <input
                type="checkbox"
                id={`motivo-${m}`}
                checked={!!seleccionados[m]}
                onChange={() => toggleMotivo(m)}
                disabled={yaOtorgado}
              />
              <label htmlFor={`motivo-${m}`}>{m}</label>
            </div>
          ))}
        </div>
        <label style={{ marginTop: 10, display: "block" }}>Otro motivo</label>
        <input
          value={otroMotivoTexto}
          onChange={(e) => setOtroMotivoTexto(e.target.value)}
          placeholder="Detalle del motivo (opcional)"
          disabled={yaOtorgado}
        />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Autorizado por local *</label>
        <input
          value={autorizadoPorLocal}
          onChange={(e) => setAutorizadoPorLocal(e.target.value.toUpperCase())}
          placeholder="Nombre de quien autoriza desde el local"
          required
          disabled={yaOtorgado}
        />
      </div>

      <button
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 16 }}
        disabled={cargando}
        onClick={yaOtorgado ? () => intentarImprimir() : confirmar}
      >
        {cargando ? "Procesando..." : yaOtorgado ? "Reintentar impresión" : "Otorgar permiso e imprimir"}
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Reingreso tras un permiso de salida: la máquina del estacionamiento le
// entrega al guía un ticket nuevo al volver a entrar, así que hay que
// actualizarlo en la visita antes de quitar la marca de permiso de salida.
// ---------------------------------------------------------------------------

function ModalReingresoVisita({ visita, onClose, mostrarToast }) {
  const [nuevoTicket, setNuevoTicket] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function confirmar(e) {
    e.preventDefault();
    if (!nuevoTicket.trim()) {
      setError("Ingresá el número de ticket que le dieron al guía al volver a entrar.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      await db.collection("visitas").doc(visita.id).update({
        ticketEstacionamiento: nuevoTicket.trim().toUpperCase(),
        permisoSalida: false,
        permisoSalidaPor: firebase.firestore.FieldValue.delete(),
        permisoSalidaFecha: firebase.firestore.FieldValue.delete(),
        motivosSalida: firebase.firestore.FieldValue.delete(),
        autorizadoPorLocal: firebase.firestore.FieldValue.delete()
      });
      mostrarToast("Reingreso registrado con el nuevo ticket.");
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el reingreso. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo={`Reingreso — ${visita.guiaNombre}`}
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={confirmar} disabled={cargando}>
            {cargando ? "Guardando..." : "Confirmar reingreso"}
          </button>
        </React.Fragment>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        El guía salió con permiso y volvió a entrar con un ticket de estacionamiento
        nuevo. Cargá ese número para reemplazar el anterior
        (<strong>{visita.ticketEstacionamiento}</strong>) en esta visita.
      </p>
      <form onSubmit={confirmar}>
        <div className="field">
          <label>Nuevo N° de ticket de estacionamiento</label>
          <input
            value={nuevoTicket}
            onChange={(e) => setNuevoTicket(e.target.value.toUpperCase())}
            placeholder="Número impreso en el ticket"
            autoFocus
            required
          />
        </div>
      </form>
    </Modal>
  );
}

async function generarPdfLiberacion(visita, usuarioNombre) {
  const { jsPDF } = window.jspdf;
  const ancho = 100;
  const altoMitad = 150;
  const doc = new jsPDF({ unit: "mm", format: [ancho, altoMitad * 2] });

  const logo = await obtenerLogoParaPdf();

  function dibujarCopia(yBase, etiqueta) {
    const margen = 10;
    let y = yBase + 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(etiqueta, ancho - margen, yBase + 8, { align: "right" });
    doc.setTextColor(0);

    if (logo) {
      try {
        doc.addImage(logo.dataUrl, logo.formato, margen, yBase + 8, 16, 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("SHOPPING PARIS", margen + 20, yBase + 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Comprobante de liberación", margen + 20, yBase + 20);
        y = yBase + 30;
      } catch (err) {
        console.warn("No se pudo incrustar el logo en el PDF:", err);
      }
    }

    if (y === yBase + 16) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("SHOPPING PARIS", margen, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Comprobante de liberación de estacionamiento", margen, y);
      y += 4;
    }

    doc.setLineWidth(0.3);
    doc.line(margen, y, ancho - margen, y);
    y += 7;

    function fila(etiquetaCampo, valor) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(etiquetaCampo, margen, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(valor), margen, y + 4.5);
      y += 10.5;
    }

    fila("Guía", visita.guiaNombre);
    fila("Empresa", visita.empresaNombre);
    fila("Vehículo / Chapa", `${visita.vehiculoTipoNombre} — ${visita.chapa}`);
    fila("N° Ticket de estacionamiento", visita.ticketEstacionamiento);
    fila("Ingreso", formatearFechaHora(visita.fechaHoraIngreso));
    fila("Salida", formatearFechaHora(new Date()));
    fila("Tiempo de permanencia", tiempoTranscurrido(visita.fechaHoraIngreso));
    fila("Monto acumulado en compras", `$ ${Number(visita.montoAcumulado || 0).toLocaleString("es-AR")}`);

    doc.setLineWidth(0.3);
    doc.line(margen, y, ancho - margen, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Liberado por: ${usuarioNombre}`, margen, y);
    y += 4.5;
    doc.text(`Emitido: ${new Date().toLocaleString("es-PY")}`, margen, y);
  }

  dibujarCopia(0, "ORIGINAL");

  // Línea de corte punteada en la mitad de la hoja.
  doc.setDrawColor(160);
  doc.setLineDashPattern([2, 2], 0);
  doc.setLineWidth(0.3);
  doc.line(4, altoMitad, ancho - 4, altoMitad);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0);
  doc.setFontSize(7);
  doc.setTextColor(160);
  doc.text("✂ cortar acá", ancho / 2, altoMitad - 1.5, { align: "center" });
  doc.setTextColor(0);

  dibujarCopia(altoMitad, "COPIA — PARA EL GUÍA");

  doc.save(`liberacion-ticket-${visita.ticketEstacionamiento}.pdf`);
}

// ---------------------------------------------------------------------------
// Numeración secuencial (liberaciones y permisos de salida)
// ---------------------------------------------------------------------------
// Cada tipo de documento tiene su propio contador en Firestore
// (colección "contadores", documentos "liberaciones" / "permisosSalida").
// Se incrementa de forma atómica junto con el guardado del documento
// principal, todo dentro de la misma transacción — así nunca se repite un
// número ni se pierde uno aunque dos operadores actúen casi al mismo tiempo.
async function asignarNumeroSecuencial(contadorId, docRef, campoNumero, camposExtra) {
  const contadorRef = db.collection("contadores").doc(contadorId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(contadorRef);
    const actual = snap.exists ? Number(snap.data().ultimo) || 0 : 0;
    const siguiente = actual + 1;
    tx.set(contadorRef, { ultimo: siguiente }, { merge: true });
    tx.update(docRef, { ...camposExtra, [campoNumero]: siguiente });
    return siguiente;
  });
}

function formatearNumeroSecuencial(n) {
  return String(n).padStart(6, "0");
}

// ---------------------------------------------------------------------------
// Impresión directa del comprobante de liberación (impresora térmica de red)
// ---------------------------------------------------------------------------
// En vez de descargar un PDF, el ticket sale directo por la impresora térmica
// (Epson TM-T20IV-L) conectada en red, a través de un pequeño servidor local
// ("print-bridge") que corre en la PC del punto de cobro y escucha en
// http://localhost:5555. Ver la carpeta print-bridge/ para el detalle.

const PRINT_BRIDGE_URL = "http://localhost:5555/imprimir";
const LLAVE_ULTIMO_TICKET = "spx_ultimoTicketLiberado";

// Manda un pedido de impresión al servidor local. Devuelve true/false en vez
// de tirar error, para que la app pueda mostrar un aviso simple ("no se pudo
// imprimir, revisá el servidor") sin romper el flujo de la liberación.
async function imprimirDirecto({ lines, logo, cortar = true }) {
  try {
    const res = await fetch(PRINT_BRIDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, logo: logo || null, cortar }),
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    return !!data.ok;
  } catch (err) {
    console.warn("No se pudo imprimir directo:", err);
    return false;
  }
}

// Una "fila" del comprobante: etiqueta en negrita arriba, valor debajo.
function filaComprobante(etiqueta, valor) {
  return [
    { text: etiqueta, bold: true, align: "left" },
    { text: String(valor), align: "left" }
  ];
}

function construirLineasComprobante(visita, usuarioNombre, rotulo, partner, numeroLiberacion) {
  const L = [];
  if (rotulo) L.push({ text: rotulo, bold: true, align: "center" });
  L.push({ text: "SHOPPING PARIS", bold: true, big: true, align: "center" });
  L.push({ text: "Comprobante de liberacion de estacionamiento", align: "center" });
  L.push({ text: "--------------------------------", align: "center" });
  if (numeroLiberacion) {
    L.push({ text: `N Liberacion: ${formatearNumeroSecuencial(numeroLiberacion)}`, bold: true, align: "center" });
  }
  L.push(...filaComprobante("Guia", visita.guiaNombre));
  L.push(...filaComprobante("Empresa", visita.empresaNombre));
  L.push(...filaComprobante("Vehiculo / Chapa", `${visita.vehiculoTipoNombre} - ${visita.chapa}`));
  L.push(...filaComprobante("N Ticket de estacionamiento", visita.ticketEstacionamiento));
  L.push(...filaComprobante("Ingreso", formatearFechaHora(visita.fechaHoraIngreso)));
  L.push(...filaComprobante("Salida", formatearFechaHora(visita.fechaHoraSalida || new Date())));
  L.push(...filaComprobante("Tiempo de permanencia", tiempoTranscurrido(visita.fechaHoraIngreso)));
  if (partner) {
    L.push(...filaComprobante("Liberacion", "PARTNER (sin monto minimo)"));
  } else {
    L.push(...filaComprobante("Monto acumulado en compras", `$ ${Number(visita.montoAcumulado || 0).toLocaleString("es-AR")}`));
  }
  L.push({ text: "--------------------------------", align: "center" });
  L.push({ text: `Liberado por: ${usuarioNombre}` });
  L.push({ text: `Emitido: ${new Date().toLocaleString("es-PY")}` });
  // Espacio para que el operador firme a mano sobre el papel.
  L.push({ text: " " });
  L.push({ text: " " });
  L.push({ text: "Firma del operador:" });
  L.push({ text: "________________________" });
  return L;
}

// Reutiliza el mismo logo que ya usa el PDF (config/branding en Firestore + Storage).
async function obtenerLogoBase64ParaTicket() {
  const logo = await obtenerLogoParaPdf();
  return logo ? logo.dataUrl : null;
}

// Imprime las 2 copias del comprobante (una para el guía, una para el shopping),
// cada una como un ticket separado (corta papel entre una y otra). "partner"
// indica que se liberó sin exigir el monto mínimo (tienda Partner del shopping).
async function imprimirComprobanteLiberacion(visita, usuarioNombre, partner, numeroLiberacion) {
  const logo = await obtenerLogoBase64ParaTicket();
  const okGuia = await imprimirDirecto({
    lines: construirLineasComprobante(visita, usuarioNombre, "COPIA: GUÍA", partner, numeroLiberacion),
    logo,
    cortar: true
  });
  if (!okGuia) return false;
  const okShopping = await imprimirDirecto({
    lines: construirLineasComprobante(visita, usuarioNombre, "COPIA: SHOPPING", partner, numeroLiberacion),
    logo,
    cortar: true
  });
  return okShopping;
}

// ---------------------------------------------------------------------------
// Impresión directa del permiso de salida (misma impresora térmica)
// ---------------------------------------------------------------------------

function construirLineasPermisoSalida(visita, usuarioNombre, motivos, autorizadoPorLocal, rotulo, numeroPermiso) {
  const L = [];
  if (rotulo) L.push({ text: rotulo, bold: true, align: "center" });
  L.push({ text: "SHOPPING PARIS", bold: true, big: true, align: "center" });
  L.push({ text: "Permiso de salida de estacionamiento", align: "center" });
  L.push({ text: "--------------------------------", align: "center" });
  if (numeroPermiso) {
    L.push({ text: `N Permiso: ${formatearNumeroSecuencial(numeroPermiso)}`, bold: true, align: "center" });
  }
  L.push(...filaComprobante("Guia", visita.guiaNombre));
  L.push(...filaComprobante("Empresa", visita.empresaNombre));
  L.push(...filaComprobante("Vehiculo / Chapa", `${visita.vehiculoTipoNombre} - ${visita.chapa}`));
  L.push(...filaComprobante("N Ticket de estacionamiento", visita.ticketEstacionamiento));
  L.push(...filaComprobante("Motivo de la salida", (motivos || []).join(" / ") || "-"));
  L.push(...filaComprobante("Autorizado por local", (autorizadoPorLocal || "-").toUpperCase()));
  L.push({ text: "--------------------------------", align: "center" });
  L.push({ text: `Otorgado por: ${usuarioNombre}` });
  L.push({ text: `Emitido: ${new Date().toLocaleString("es-PY")}` });
  // Espacio en blanco para firmar a mano sobre el papel (lapicera), ya que
  // al ser un ticket térmico no hay firma digital posible.
  L.push({ text: " " });
  L.push({ text: " " });
  L.push({ text: "Firma del guia:" });
  L.push({ text: "________________________" });
  L.push({ text: " " });
  L.push({ text: " " });
  L.push({ text: "Firma autorizante local:" });
  L.push({ text: "________________________" });
  return L;
}

// Imprime las 2 copias del permiso de salida (una para el guía, una para el
// local), cada una como un ticket separado.
async function imprimirPermisoSalida(visita, usuarioNombre, motivos, autorizadoPorLocal, numeroPermiso) {
  const logo = await obtenerLogoBase64ParaTicket();
  const okGuia = await imprimirDirecto({
    lines: construirLineasPermisoSalida(visita, usuarioNombre, motivos, autorizadoPorLocal, "COPIA: GUÍA", numeroPermiso),
    logo,
    cortar: true
  });
  if (!okGuia) return false;
  const okLocal = await imprimirDirecto({
    lines: construirLineasPermisoSalida(visita, usuarioNombre, motivos, autorizadoPorLocal, "COPIA: LOCAL", numeroPermiso),
    logo,
    cortar: true
  });
  return okLocal;
}

// Guarda el último ticket liberado en el navegador para poder reimprimirlo más
// tarde (por ejemplo si la impresora estaba apagada en el momento). Se guarda
// por unas horas nomás, para no arriesgarse a reimprimir un ticket viejo por error.
function guardarUltimoTicketLiberado(visita, usuarioNombre) {
  try {
    localStorage.setItem(LLAVE_ULTIMO_TICKET, JSON.stringify({ visita, usuarioNombre, guardadoEn: Date.now() }));
  } catch (err) {
    console.warn("No se pudo guardar el último ticket liberado:", err);
  }
}

function obtenerUltimoTicketLiberado() {
  try {
    const raw = localStorage.getItem(LLAVE_ULTIMO_TICKET);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.guardadoEn > 1000 * 60 * 60 * 4) return null; // vence a las 4hs
    return data;
  } catch (err) {
    return null;
  }
}

function ModalLiberarVisita({ visita, perfil, modoPartner, onClose, mostrarToast }) {
  const [montoNuevo, setMontoNuevo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const porcentaje = visita.montoMinimoRequerido > 0
    ? Math.min(100, Math.round((visita.montoAcumulado / visita.montoMinimoRequerido) * 100))
    : 0;
  const alcanzado = !!modoPartner || visita.montoAcumulado >= visita.montoMinimoRequerido;
  const falta = Math.max(0, visita.montoMinimoRequerido - visita.montoAcumulado);

  async function agregarMonto(e) {
    e.preventDefault();
    setError("");
    const valor = Number(montoNuevo);
    if (!valor || valor <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setCargando(true);
    try {
      await db.collection("visitas").doc(visita.id).update({
        montoAcumulado: firebase.firestore.FieldValue.increment(valor)
      });
      mostrarToast("Monto registrado.");
      setMontoNuevo("");
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar el monto. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  // Cuando la impresión falla pero el estacionamiento ya quedó liberado en la
  // base, no hay que reintentar el paso de Firestore — solo la impresión.
  const [yaLiberado, setYaLiberado] = useState(false);
  const [numeroLiberacion, setNumeroLiberacion] = useState(null);

  async function liberar() {
    setCargando(true);
    setError("");
    let numero;
    try {
      numero = await asignarNumeroSecuencial(
        "liberaciones",
        db.collection("visitas").doc(visita.id),
        "numeroLiberacion",
        {
          estado: "liberado",
          fechaHoraSalida: firebase.firestore.FieldValue.serverTimestamp(),
          usuarioSalidaId: perfil.id,
          usuarioSalidaNombre: perfil.nombre,
          liberadoComoPartner: !!modoPartner
        }
      );
      setNumeroLiberacion(numero);
      setYaLiberado(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo liberar el estacionamiento. Probá de nuevo.");
      setCargando(false);
      return;
    }
    await intentarImprimir(numero);
  }

  async function intentarImprimir(numeroParam) {
    const numero = numeroParam || numeroLiberacion;
    setCargando(true);
    setError("");
    const ok = await imprimirComprobanteLiberacion(visita, perfil.nombre, modoPartner, numero);
    if (ok) {
      guardarUltimoTicketLiberado({ ...visita, numeroLiberacion: numero, liberadoComoPartner: !!modoPartner }, perfil.nombre);
      mostrarToast(`Estacionamiento liberado: ${visita.guiaNombre}`);
      setCargando(false);
      onClose();
    } else {
      setError(
        "El estacionamiento se liberó, pero no se pudo imprimir el ticket. " +
        "Verificá que la PC de la impresora esté prendida y el servidor de impresión abierto, y volvé a intentar."
      );
      setCargando(false);
    }
  }

  return (
    <Modal titulo={`${visita.guiaNombre} — ${visita.ticketEstacionamiento}`} onClose={onClose}>
      {error && <div className="form-error">{error}</div>}

      <div className="ticket-meta" style={{ marginBottom: 14 }}>
        <span><strong>Empresa:</strong> {visita.empresaNombre}</span>
        <span><strong>Vehículo:</strong> {visita.vehiculoTipoNombre} · {visita.chapa}</span>
        <span><strong>Pasajeros:</strong> {visita.cantPasajeros}</span>
        <span><strong>En sala:</strong> {tiempoTranscurrido(visita.fechaHoraIngreso)}</span>
      </div>

      {modoPartner ? (
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--gold)",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 18,
            fontSize: 13
          }}
        >
          <strong>Liberación Partner:</strong> se va a liberar el estacionamiento sin exigir el monto mínimo de compra, ya que la empresa es tienda Partner del shopping.
        </div>
      ) : (
        <React.Fragment>
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>
                $ {Number(visita.montoAcumulado || 0).toLocaleString("es-AR")} de $ {Number(visita.montoMinimoRequerido || 0).toLocaleString("es-AR")}
              </span>
              <span style={{ fontWeight: 600 }}>{porcentaje}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--paper)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${porcentaje}%`,
                  background: alcanzado ? "var(--success)" : "var(--gold)",
                  transition: "width 0.2s ease"
                }}
              ></div>
            </div>
            {!alcanzado && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Faltan $ {falta.toLocaleString("es-AR")} para liberar el estacionamiento.
              </p>
            )}
            {alcanzado && (
              <p style={{ fontSize: 12, color: "var(--success)", marginTop: 6, fontWeight: 600 }}>
                ✓ Alcanzó el monto mínimo — ya se puede liberar.
              </p>
            )}
          </div>

          <form onSubmit={agregarMonto} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Monto del comprobante"
              value={montoNuevo}
              onChange={(e) => setMontoNuevo(e.target.value)}
              style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}
            />
            <button className="btn btn-ghost" disabled={cargando}>Agregar</button>
          </form>
        </React.Fragment>
      )}

      <button
        className="btn btn-primary"
        disabled={(!alcanzado && !yaLiberado) || cargando}
        onClick={yaLiberado ? () => intentarImprimir() : liberar}
      >
        {cargando
          ? "Procesando..."
          : yaLiberado
          ? "Reintentar impresión"
          : "Liberar estacionamiento y emitir ticket"}
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cierre de día: cierra en lote todas las visitas que quedaron abiertas
// ---------------------------------------------------------------------------

function ModalCierreDia({ visitas, perfil, onClose, mostrarToast }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const preview = visitas.map((v) => ({
    ...v,
    seLiberará: (v.montoAcumulado || 0) >= (v.montoMinimoRequerido || 0)
  }));
  const cantidadLiberadas = preview.filter((v) => v.seLiberará).length;
  const cantidadNoLiberadas = preview.length - cantidadLiberadas;

  async function confirmarCierre() {
    setCargando(true);
    setError("");
    try {
      // Firestore permite hasta 500 escrituras por batch; para la escala de
      // una sola sala de guías esto sobra de sobra.
      const batch = db.batch();
      preview.forEach((v) => {
        const ref = db.collection("visitas").doc(v.id);
        batch.update(ref, {
          estado: v.seLiberará ? "liberado" : "no_liberado",
          fechaHoraSalida: firebase.firestore.FieldValue.serverTimestamp(),
          usuarioSalidaId: perfil.id,
          usuarioSalidaNombre: perfil.nombre,
          cerradaPorCierreDia: true
        });
      });
      await batch.commit();
      mostrarToast(`Día cerrado: ${cantidadLiberadas} liberadas, ${cantidadNoLiberadas} no liberadas.`);
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo completar el cierre de día. Probá de nuevo.");
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo="Cerrar día"
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{ width: "auto", padding: "11px 20px" }} onClick={confirmarCierre} disabled={cargando}>
            {cargando ? "Cerrando..." : "Confirmar cierre de día"}
          </button>
        </React.Fragment>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 14 }}>
        Se van a cerrar <strong>{preview.length}</strong> visitas que siguen abiertas. Las que alcanzaron
        el monto mínimo quedan <strong>liberadas</strong>; las que no, quedan marcadas como
        <strong> no liberadas</strong> (el guía abona el estacionamiento por caja tradicional).
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <span className="badge badge-success">{cantidadLiberadas} se liberarán</span>
        <span className="badge badge-alert">{cantidadNoLiberadas} no liberadas</span>
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Guía</th>
              <th>Ticket</th>
              <th>Monto</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((v) => (
              <tr key={v.id}>
                <td>{v.guiaNombre}</td>
                <td>{v.ticketEstacionamiento}</td>
                <td>$ {Number(v.montoAcumulado || 0).toLocaleString("es-AR")} / $ {Number(v.montoMinimoRequerido || 0).toLocaleString("es-AR")}</td>
                <td>
                  {v.seLiberará ? (
                    <span className="badge badge-success">Liberado</span>
                  ) : (
                    <span className="badge badge-alert">No liberado</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista: Guías (corrección de nombre, con sincronización a visitas en curso)
// ---------------------------------------------------------------------------

function GuiasView({ mostrarToast }) {
  const [guias, setGuias] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const unsub = db.collection("guias").orderBy("nombre").onSnapshot((snap) =>
      setGuias(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Sala de guías</div>
          <h1>Guías</h1>
          <p className="page-desc">Corregí el nombre de un guía si se cargó mal desde el formulario de Visitas.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {guias.length === 0 ? (
            <div className="empty-state">
              <div className="display">Todavía no hay guías cargados</div>
              <p>Se crean automáticamente al registrar una visita nueva.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre y apellido</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {guias.map((g) => (
                  <tr key={g.id}>
                    <td>{g.nombre}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="icon-btn" onClick={() => setModal(g)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <ModalGuia guia={modal} onClose={() => setModal(null)} mostrarToast={mostrarToast} />
      )}
    </div>
  );
}

function ModalGuia({ guia, onClose, mostrarToast }) {
  const [nombre, setNombre] = useState(guia.nombre || "");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      const nombreNuevo = nombre.trim();
      await db.collection("guias").doc(guia.id).update({ nombre: nombreNuevo });

      // Propaga la corrección a las visitas en curso de este guía, para que
      // las tarjetas que ya están abiertas muestren el nombre corregido.
      const abiertas = await db
        .collection("visitas")
        .where("guiaId", "==", guia.id)
        .where("estado", "==", "en_curso")
        .get();
      if (!abiertas.empty) {
        const batch = db.batch();
        abiertas.docs.forEach((d) => batch.update(d.ref, { guiaNombre: nombreNuevo }));
        await batch.commit();
      }

      mostrarToast("Guía actualizado.");
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el cambio. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo="Editar guía"
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </React.Fragment>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={guardar}>
        <div className="field">
          <label>Nombre y apellido</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} required />
        </div>
      </form>
      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Si este guía tiene una visita en curso ahora mismo, también se actualiza en esa tarjeta.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista: Tienda — carga básica de datos desde un punto de venta del shopping,
// sin manejo de estacionamiento ni impresión de comprobantes. Un usuario
// puede estar asignado a una o varias tiendas (perfil.tiendaIds).
// ---------------------------------------------------------------------------

function TiendaView({ perfil, mostrarToast }) {
  const [guias, setGuias] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [tiposVehiculo, setTiposVehiculo] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [registroParaEditar, setRegistroParaEditar] = useState(null);
  const [registroParaSalida, setRegistroParaSalida] = useState(null);

  const misTiendaIds = perfil.tiendaIds || [];
  const misTiendas = tiendas.filter((t) => misTiendaIds.includes(t.id));

  useEffect(() => {
    const u1 = db.collection("guias").orderBy("nombre").onSnapshot((s) =>
      setGuias(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = db.collection("empresas").orderBy("nombre").onSnapshot((s) =>
      setEmpresas(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.activo !== false))
    );
    const u3 = db.collection("tiposVehiculo").orderBy("nombre").onSnapshot((s) =>
      setTiposVehiculo(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.activo !== false))
    );
    const u4 = db.collection("tiendas").orderBy("nombre").onSnapshot((s) =>
      setTiendas(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.activo !== false))
    );
    // Se trae un lote grande y se filtra por tienda del lado del cliente,
    // para no necesitar un índice compuesto en Firestore (where "in" + orderBy).
    const u5 = db
      .collection("registrosTienda")
      .orderBy("fechaHoraIngreso", "desc")
      .limit(200)
      .onSnapshot((s) => setRegistros(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  async function anularRegistro(r) {
    const confirmar = window.confirm(
      `¿Anular el registro de "${r.guiaNombre}"? No se puede deshacer.`
    );
    if (!confirmar) return;
    try {
      await db.collection("registrosTienda").doc(r.id).delete();
      mostrarToast("Registro anulado.");
    } catch (err) {
      console.error(err);
      mostrarToast("No se pudo anular el registro.");
    }
  }

  const registrosDeMisTiendas = registros
    .filter((r) => misTiendaIds.includes(r.tiendaId))
    .slice(0, 50);

  const registrosFiltrados = busqueda.trim()
    ? registrosDeMisTiendas.filter((r) => (r.guiaNombre || "").toLowerCase().includes(busqueda.trim().toLowerCase()))
    : registrosDeMisTiendas;

  if (misTiendas.length === 0) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-eyebrow">Tienda</div>
            <h1>Sin tienda asignada</h1>
            <p className="page-desc">
              Tu usuario todavía no tiene ninguna tienda asignada. Pedile a un Admin que te
              asigne una desde "Usuarios y roles".
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Tienda</div>
          <h1>{misTiendas.length === 1 ? misTiendas[0].nombre : "Registro de tienda"}</h1>
          <p className="page-desc">
            Carga de datos desde este punto de atención. No maneja estacionamiento ni imprime comprobantes.
          </p>
        </div>
      </div>

      <FormularioRegistroTienda
        guias={guias}
        empresas={empresas}
        tiposVehiculo={tiposVehiculo}
        misTiendas={misTiendas}
        perfil={perfil}
        mostrarToast={mostrarToast}
      />

      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 18, whiteSpace: "nowrap" }}>Registros recientes</h2>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de guía..."
            style={{ flex: "1 1 240px", maxWidth: 420, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8 }}
          />
          <span className="badge badge-gold" style={{ marginLeft: "auto" }}>{registrosDeMisTiendas.length}</span>
        </div>

        <div className="panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {registrosDeMisTiendas.length === 0 ? (
              <div className="empty-state">
                <div className="display">Todavía no hay registros</div>
                <p>Los que cargues acá van a aparecer en esta lista.</p>
              </div>
            ) : registrosFiltrados.length === 0 ? (
              <div className="empty-state">
                <div className="display">Sin resultados</div>
                <p>Ningún registro coincide con "{busqueda}".</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    {misTiendas.length > 1 && <th>Tienda</th>}
                    <th>Guía</th>
                    <th>Empresa</th>
                    <th>Vehículo</th>
                    <th>Pasajeros</th>
                    <th>Salida</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.map((r) => (
                    <tr key={r.id}>
                      <td>{formatearFechaHora(r.fechaHoraIngreso)}</td>
                      {misTiendas.length > 1 && <td>{r.tiendaNombre}</td>}
                      <td>
                        <button
                          onClick={() => setRegistroParaSalida(r)}
                          title="Registrar hora de salida"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            font: "inherit",
                            color: "var(--ink)",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textDecorationColor: "var(--line)",
                            cursor: "pointer"
                          }}
                        >
                          {r.guiaNombre}
                        </button>
                      </td>
                      <td>{r.empresaNombre}</td>
                      <td>{r.vehiculoTipoNombre} · {r.chapa}</td>
                      <td>{r.cantPasajeros}</td>
                      <td>
                        {r.fechaHoraSalida ? (
                          formatearFechaHora(r.fechaHoraSalida)
                        ) : (
                          <span className="badge badge-muted">Pendiente</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="icon-btn" onClick={() => setRegistroParaEditar(r)} title="Editar">✎</button>
                        <button className="icon-btn" onClick={() => anularRegistro(r)} title="Anular" style={{ color: "var(--alert)" }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {registroParaEditar && (
        <ModalEditarRegistroTienda
          registro={registroParaEditar}
          empresas={empresas}
          tiposVehiculo={tiposVehiculo}
          misTiendas={misTiendas}
          onClose={() => setRegistroParaEditar(null)}
          mostrarToast={mostrarToast}
        />
      )}

      {registroParaSalida && (
        <ModalRegistrarSalidaTienda
          registro={registroParaSalida}
          onClose={() => setRegistroParaSalida(null)}
          mostrarToast={mostrarToast}
        />
      )}
    </div>
  );
}

function FormularioRegistroTienda({ guias, empresas, tiposVehiculo, misTiendas, perfil, mostrarToast }) {
  const [nombreGuia, setNombreGuia] = useState("");
  const [guiaSeleccionado, setGuiaSeleccionado] = useState(null);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [tiendaId, setTiendaId] = useState(misTiendas.length === 1 ? misTiendas[0].id : "");
  const [empresaId, setEmpresaId] = useState("");
  const [cantPasajeros, setCantPasajeros] = useState("");
  const [vehiculoTipoId, setVehiculoTipoId] = useState("");
  const [chapa, setChapa] = useState("");
  const [ticket, setTicket] = useState("");
  const [horaIngreso, setHoraIngreso] = useState(horaActualHHMM());
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const sugerencias =
    nombreGuia.trim().length > 0
      ? guias.filter((g) => g.nombre.toLowerCase().includes(nombreGuia.trim().toLowerCase())).slice(0, 6)
      : [];

  function elegirGuia(g) {
    setGuiaSeleccionado(g);
    setNombreGuia(g.nombre);
    setMostrarSugerencias(false);
  }

  function cambiarNombreGuia(valor) {
    setNombreGuia(valor.toUpperCase());
    setGuiaSeleccionado(null);
    setMostrarSugerencias(true);
  }

  function limpiarFormulario() {
    setNombreGuia("");
    setGuiaSeleccionado(null);
    setEmpresaId("");
    setCantPasajeros("");
    setVehiculoTipoId("");
    setChapa("");
    setTicket("");
    setHoraIngreso(horaActualHHMM());
    // La tienda seleccionada se mantiene entre registros (uso típico: varios
    // ingresos seguidos para la misma tienda), salvo que solo haya una.
  }

  async function registrar(e) {
    e.preventDefault();
    setError("");
    if (!nombreGuia.trim() || !tiendaId || !empresaId || !vehiculoTipoId || !chapa.trim() || !cantPasajeros) {
      setError("Completá tienda, guía, empresa, pasajeros, tipo de vehículo y chapa.");
      return;
    }
    setCargando(true);
    try {
      let guiaId = guiaSeleccionado ? guiaSeleccionado.id : null;
      if (!guiaId) {
        const nuevoGuia = await db.collection("guias").add({
          nombre: nombreGuia.trim(),
          creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        guiaId = nuevoGuia.id;
      }

      const tienda = misTiendas.find((t) => t.id === tiendaId);
      const empresa = empresas.find((e) => e.id === empresaId);
      const tipoVehiculo = tiposVehiculo.find((t) => t.id === vehiculoTipoId);

      const [hh, mm] = horaIngreso.split(":").map(Number);
      const fechaHoraIngreso = new Date();
      fechaHoraIngreso.setHours(hh, mm, 0, 0);

      await db.collection("registrosTienda").add({
        tiendaId,
        tiendaNombre: tienda ? tienda.nombre : "",
        guiaId,
        guiaNombre: nombreGuia.trim(),
        empresaId,
        empresaNombre: empresa ? empresa.nombre : "",
        vehiculoTipoId,
        vehiculoTipoNombre: tipoVehiculo ? tipoVehiculo.nombre : "",
        chapa: chapa.trim().toUpperCase(),
        cantPasajeros: Number(cantPasajeros),
        ticketEstacionamiento: ticket.trim(),
        fechaHoraIngreso: firebase.firestore.Timestamp.fromDate(fechaHoraIngreso),
        usuarioIngresoId: perfil.id,
        usuarioIngresoNombre: perfil.nombre
      });

      mostrarToast(`Registro cargado: ${nombreGuia.trim()}`);
      limpiarFormulario();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el registro. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Nuevo registro</h2>
      </div>
      <div className="panel-body">
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={registrar}>
          {misTiendas.length > 1 && (
            <div className="field">
              <label>Tienda</label>
              <select value={tiendaId} onChange={(e) => setTiendaId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {misTiendas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="field autocomplete">
            <label>Guía</label>
            <input
              value={nombreGuia}
              onChange={(e) => cambiarNombreGuia(e.target.value)}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
              placeholder="Nombre y apellido"
              autoComplete="off"
              required
            />
            {mostrarSugerencias && nombreGuia.trim() && (
              <div className="autocomplete-list">
                {sugerencias.map((g) => (
                  <div key={g.id} className="autocomplete-item" onMouseDown={() => elegirGuia(g)}>
                    {g.nombre}
                  </div>
                ))}
                {!sugerencias.some((g) => g.nombre.toLowerCase() === nombreGuia.trim().toLowerCase()) && (
                  <div className="autocomplete-item crear-nuevo" onMouseDown={() => setMostrarSugerencias(false)}>
                    + Crear guía nuevo: "{nombreGuia.trim()}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Cantidad de pasajeros</label>
              <input type="number" min="1" value={cantPasajeros} onChange={(e) => setCantPasajeros(e.target.value)} required />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tipo de vehículo</label>
              <select value={vehiculoTipoId} onChange={(e) => setVehiculoTipoId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {tiposVehiculo.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Chapa</label>
              <input value={chapa} onChange={(e) => setChapa(e.target.value.toUpperCase())} placeholder="AB 123 CD" required />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Ticket de estacionamiento (opcional)</label>
              <input value={ticket} onChange={(e) => setTicket(e.target.value.toUpperCase())} placeholder="Si corresponde" />
            </div>
            <div className="field">
              <label>Hora de ingreso</label>
              <input type="time" value={horaIngreso} onChange={(e) => setHoraIngreso(e.target.value)} required />
            </div>
          </div>

          <button className="btn btn-primary" disabled={cargando} style={{ width: "auto", padding: "11px 24px" }}>
            {cargando ? "Guardando..." : "Registrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalEditarRegistroTienda({ registro, empresas, tiposVehiculo, misTiendas, onClose, mostrarToast }) {
  const [tiendaId, setTiendaId] = useState(registro.tiendaId || "");
  const [nombreGuia, setNombreGuia] = useState(registro.guiaNombre || "");
  const [empresaId, setEmpresaId] = useState(registro.empresaId || "");
  const [cantPasajeros, setCantPasajeros] = useState(registro.cantPasajeros || "");
  const [vehiculoTipoId, setVehiculoTipoId] = useState(registro.vehiculoTipoId || "");
  const [chapa, setChapa] = useState(registro.chapa || "");
  const [ticket, setTicket] = useState(registro.ticketEstacionamiento || "");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();
    if (!tiendaId || !nombreGuia.trim() || !empresaId || !vehiculoTipoId || !chapa.trim() || !cantPasajeros) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      const tienda = misTiendas.find((t) => t.id === tiendaId);
      const empresa = empresas.find((e) => e.id === empresaId);
      const tipoVehiculo = tiposVehiculo.find((t) => t.id === vehiculoTipoId);

      await db.collection("registrosTienda").doc(registro.id).update({
        tiendaId,
        tiendaNombre: tienda ? tienda.nombre : registro.tiendaNombre || "",
        guiaNombre: nombreGuia.trim(),
        empresaId,
        empresaNombre: empresa ? empresa.nombre : "",
        vehiculoTipoId,
        vehiculoTipoNombre: tipoVehiculo ? tipoVehiculo.nombre : "",
        chapa: chapa.trim().toUpperCase(),
        cantPasajeros: Number(cantPasajeros),
        ticketEstacionamiento: ticket.trim()
      });
      mostrarToast("Registro actualizado.");
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el cambio. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo="Editar registro"
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Guardar cambios"}
          </button>
        </React.Fragment>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={guardar}>
        {misTiendas.length > 1 && (
          <div className="field">
            <label>Tienda</label>
            <select value={tiendaId} onChange={(e) => setTiendaId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {misTiendas.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>Guía</label>
          <input value={nombreGuia} onChange={(e) => setNombreGuia(e.target.value.toUpperCase())} required />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Empresa</label>
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Cantidad de pasajeros</label>
            <input type="number" min="1" value={cantPasajeros} onChange={(e) => setCantPasajeros(e.target.value)} required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Tipo de vehículo</label>
            <select value={vehiculoTipoId} onChange={(e) => setVehiculoTipoId(e.target.value)} required>
              <option value="">Seleccionar…</option>
              {tiposVehiculo.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Chapa</label>
            <input value={chapa} onChange={(e) => setChapa(e.target.value.toUpperCase())} required />
          </div>
        </div>
        <div className="field">
          <label>Ticket de estacionamiento (opcional)</label>
          <input value={ticket} onChange={(e) => setTicket(e.target.value.toUpperCase())} />
        </div>
      </form>
    </Modal>
  );
}

function ModalRegistrarSalidaTienda({ registro, onClose, mostrarToast }) {
  const [horaSalida, setHoraSalida] = useState(horaActualHHMM());
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();
    if (!horaSalida) {
      setError("Ingresá la hora de salida.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      const [hh, mm] = horaSalida.split(":").map(Number);
      const fechaHoraSalida = new Date();
      fechaHoraSalida.setHours(hh, mm, 0, 0);

      await db.collection("registrosTienda").doc(registro.id).update({
        fechaHoraSalida: firebase.firestore.Timestamp.fromDate(fechaHoraSalida)
      });
      mostrarToast(`Salida registrada: ${registro.guiaNombre}`);
      onClose();
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar la salida. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo={`Registrar salida — ${registro.guiaNombre}`}
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Registrar salida"}
          </button>
        </React.Fragment>
      }
    >
      {error && <div className="form-error">{error}</div>}

      <div className="ticket-meta" style={{ marginBottom: 16 }}>
        <span><strong>Empresa:</strong> {registro.empresaNombre}</span>
        <span><strong>Vehículo:</strong> {registro.vehiculoTipoNombre} · {registro.chapa}</span>
        <span><strong>Ingreso:</strong> {formatearFechaHora(registro.fechaHoraIngreso)}</span>
        {registro.fechaHoraSalida && (
          <span><strong>Salida ya cargada:</strong> {formatearFechaHora(registro.fechaHoraSalida)}</span>
        )}
      </div>

      <form onSubmit={guardar}>
        <div className="field">
          <label>Hora de salida</label>
          <input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} required autoFocus />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista genérica de catálogo simple (Empresas / Tipos de vehículo)
// ---------------------------------------------------------------------------

function CatalogoView({ titulo, descripcion, coleccion, campos, mostrarToast }) {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const unsub = db.collection(coleccion).orderBy("nombre").onSnapshot((snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [coleccion]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Catálogo</div>
          <h1>{titulo}</h1>
          <p className="page-desc">{descripcion}</p>
        </div>
        <button className="btn btn-gold" onClick={() => setModal({})}>+ Agregar</button>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="display">Sin registros todavía</div>
              <p>Agregá el primero con el botón de arriba.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {campos.map((c) => (
                    <th key={c.id}>{c.label}</th>
                  ))}
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {campos.map((c) => (
                      <td key={c.id}>
                        {c.tipo === "moneda" && item[c.id] != null
                          ? `$ ${Number(item[c.id]).toLocaleString("es-AR")}`
                          : item[c.id]}
                      </td>
                    ))}
                    <td>
                      {item.activo !== false ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-muted">Inactivo</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="icon-btn" onClick={() => setModal(item)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <ModalCatalogo
          titulo={titulo}
          coleccion={coleccion}
          campos={campos}
          item={modal}
          onClose={() => setModal(null)}
          mostrarToast={mostrarToast}
        />
      )}
    </div>
  );
}

function ModalCatalogo({ titulo, coleccion, campos, item, onClose, mostrarToast }) {
  const esNuevo = !item.id;
  const [valores, setValores] = useState(() => {
    const base = {};
    campos.forEach((c) => {
      base[c.id] = item[c.id] ?? (c.tipo === "moneda" ? 0 : "");
    });
    base.activo = item.activo !== false;
    return base;
  });
  const [cargando, setCargando] = useState(false);

  function set(id, valor) {
    setValores((v) => ({ ...v, [id]: valor }));
  }

  async function guardar(e) {
    e.preventDefault();
    setCargando(true);
    try {
      const datos = { ...valores };
      campos.forEach((c) => {
        if (c.tipo === "moneda") datos[c.id] = Number(datos[c.id]) || 0;
      });
      if (esNuevo) {
        await db.collection(coleccion).add(datos);
      } else {
        await db.collection(coleccion).doc(item.id).update(datos);
      }
      mostrarToast("Guardado correctamente.");
      onClose();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo={esNuevo ? `Nuevo — ${titulo}` : `Editar — ${titulo}`}
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </React.Fragment>
      }
    >
      <form onSubmit={guardar}>
        {campos.map((c) => (
          <div className="field" key={c.id}>
            <label>{c.label}</label>
            <input
              type={c.tipo === "moneda" ? "number" : "text"}
              min={c.tipo === "moneda" ? 0 : undefined}
              value={valores[c.id]}
              onChange={(e) => set(c.id, c.tipo === "moneda" ? e.target.value : e.target.value.toUpperCase())}
              required
            />
          </div>
        ))}
        <div className="checkbox-row">
          <input
            type="checkbox"
            id="activo-cat"
            checked={valores.activo}
            onChange={(e) => set("activo", e.target.checked)}
          />
          <label htmlFor="activo-cat">Activo</label>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista: Reportes
// ---------------------------------------------------------------------------

function fechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const ESTADO_VISITA_LABEL = { en_curso: "En curso", liberado: "Liberado", no_liberado: "No liberado" };

// Cuenta valores distintos (no vacíos) de un campo dentro de un array de objetos.
function contarUnicos(datos, campo) {
  return new Set(datos.map((d) => d[campo]).filter((v) => v !== undefined && v !== null && v !== "")).size;
}

// Agrupa y cuenta cuántas filas hay por cada valor de un campo (ej. tipo de
// vehículo), de mayor a menor cantidad. Usado para el desglose "Por tipo de
// vehículo" en los reportes.
function contarPorCampo(datos, campo) {
  const mapa = {};
  datos.forEach((d) => {
    const key = d[campo] || "(sin especificar)";
    mapa[key] = (mapa[key] || 0) + 1;
  });
  return Object.entries(mapa)
    .map(([valor, cantidad]) => ({ valor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

// Agrupa las visitas por guía para el reporte de "personas ingresadas por guía".
function agruparPersonasPorGuia(visitas) {
  const mapa = new Map();
  for (const v of visitas) {
    const key = v.guiaNombre || "(sin nombre)";
    if (!mapa.has(key)) {
      mapa.set(key, { guia: key, empresa: v.empresaNombre || "", visitas: 0, pasajeros: 0 });
    }
    const item = mapa.get(key);
    item.visitas += 1;
    item.pasajeros += Number(v.cantPasajeros) || 0;
  }
  return Array.from(mapa.values()).sort((a, b) => b.pasajeros - a.pasajeros);
}

// Configuración de los 4 reportes desplegables desde las tarjetas de "Actividad por período".
// "totales" arma la fila de resumen que se muestra en pantalla y al pie del PDF.
const REPORTES_DETALLE_CONFIG = {
  personas: {
    titulo: "Personas ingresadas por guía",
    columnas: ["Guía", "Empresa", "Visitas", "Pasajeros"],
    datos: (visitas) => agruparPersonasPorGuia(visitas),
    filas: (datos) => datos.map((r) => [r.guia, r.empresa, r.visitas, r.pasajeros]),
    totales: (datos) => [
      { label: "Total de Guías", valor: datos.length },
      { label: "Total de Empresas", valor: contarUnicos(datos, "empresa") },
      { label: "Total de Visitas", valor: datos.reduce((acc, r) => acc + r.visitas, 0) },
      { label: "Total de Pasajeros", valor: datos.reduce((acc, r) => acc + r.pasajeros, 0) }
    ]
  },
  vehiculos: {
    titulo: "Vehículos ingresados",
    columnas: ["Fecha ingreso", "Guía", "Empresa", "Vehículo", "Chapa", "Pasajeros", "Ticket", "Estado"],
    datos: (visitas) => visitas,
    filas: (datos) => datos.map((v) => [
      formatearFechaHora(v.fechaHoraIngreso),
      v.guiaNombre,
      v.empresaNombre,
      v.vehiculoTipoNombre,
      v.chapa,
      v.cantPasajeros,
      v.ticketEstacionamiento,
      ESTADO_VISITA_LABEL[v.estado] || v.estado
    ]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guiaNombre") },
      { label: "Total de Empresas", valor: contarUnicos(datos, "empresaNombre") },
      { label: "Total de Vehículos", valor: datos.length },
      { label: "Total de Tickets", valor: contarUnicos(datos, "ticketEstacionamiento") },
      { label: "Total de Monto acumulado", valor: `$ ${datos.reduce((acc, v) => acc + (Number(v.montoAcumulado) || 0), 0).toLocaleString("es-AR")}` }
    ],
    desglose: (datos) => ({ titulo: "Por tipo de vehículo", filas: contarPorCampo(datos, "vehiculoTipoNombre") })
  },
  liberados: {
    titulo: "Vehículos liberados",
    columnas: ["Fecha ingreso", "Fecha salida", "Guía", "Empresa", "Vehículo", "Ticket", "Monto acumulado"],
    datos: (visitas) => visitas.filter((v) => v.estado === "liberado"),
    filas: (datos) => datos.map((v) => [
      formatearFechaHora(v.fechaHoraIngreso),
      formatearFechaHora(v.fechaHoraSalida),
      v.guiaNombre,
      v.empresaNombre,
      `${v.vehiculoTipoNombre} - ${v.chapa}`,
      v.ticketEstacionamiento,
      `$ ${Number(v.montoAcumulado || 0).toLocaleString("es-AR")}`
    ]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guiaNombre") },
      { label: "Total de Empresas", valor: contarUnicos(datos, "empresaNombre") },
      { label: "Total de Vehículos", valor: datos.length },
      { label: "Total de Tickets", valor: contarUnicos(datos, "ticketEstacionamiento") },
      { label: "Total de Monto acumulado", valor: `$ ${datos.reduce((acc, v) => acc + (Number(v.montoAcumulado) || 0), 0).toLocaleString("es-AR")}` }
    ],
    desglose: (datos) => ({ titulo: "Por tipo de vehículo", filas: contarPorCampo(datos, "vehiculoTipoNombre") })
  },
  no_liberados: {
    titulo: "Vehículos no liberados",
    columnas: ["Fecha", "Guía", "Empresa", "Vehículo", "Pasajeros", "Monto / Mínimo", "Faltó"],
    datos: (visitas) => visitas.filter((v) => v.estado === "no_liberado"),
    filas: (datos) => datos.map((v) => [
      formatearFechaHora(v.fechaHoraIngreso),
      v.guiaNombre,
      v.empresaNombre,
      `${v.vehiculoTipoNombre} · ${v.chapa}`,
      v.cantPasajeros,
      `$ ${Number(v.montoAcumulado || 0).toLocaleString("es-AR")} / $ ${Number(v.montoMinimoRequerido || 0).toLocaleString("es-AR")}`,
      `$ ${Math.max(0, (v.montoMinimoRequerido || 0) - (v.montoAcumulado || 0)).toLocaleString("es-AR")}`
    ]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guiaNombre") },
      { label: "Total de Empresas", valor: contarUnicos(datos, "empresaNombre") },
      { label: "Total de Vehículos", valor: datos.length },
      { label: "Total de Tickets", valor: contarUnicos(datos, "ticketEstacionamiento") },
      { label: "Total acumulado", valor: `$ ${datos.reduce((acc, v) => acc + (Number(v.montoAcumulado) || 0), 0).toLocaleString("es-AR")}` },
      { label: "Total faltante", valor: `$ ${datos.reduce((acc, v) => acc + Math.max(0, (v.montoMinimoRequerido || 0) - (v.montoAcumulado || 0)), 0).toLocaleString("es-AR")}` }
    ],
    desglose: (datos) => ({ titulo: "Por tipo de vehículo", filas: contarPorCampo(datos, "vehiculoTipoNombre") })
  }
};

function ModalReporteDetalle({ tipo, visitas, desde, hasta, onClose }) {
  const config = REPORTES_DETALLE_CONFIG[tipo];
  const datos = config.datos(visitas);
  const filas = config.filas(datos);
  const totales = config.totales ? config.totales(datos) : [];
  const desglose = config.desglose ? config.desglose(datos) : null;

  function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SHOPPING PARIS", 14, 15);
    doc.setFontSize(11);
    doc.text(config.titulo, 14, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Período: ${desde} a ${hasta} — ${filas.length} ${filas.length === 1 ? "registro" : "registros"}`, 14, 28);
    doc.autoTable({
      startY: 33,
      head: [config.columnas],
      body: filas,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [31, 78, 120], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 243, 237] }
    });

    let y = doc.lastAutoTable.finalY + 10;
    const alturaPagina = doc.internal.pageSize.getHeight();

    if (totales.length > 0) {
      if (y > alturaPagina - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Totales", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const t of totales) {
        doc.text(`${t.label}: ${t.valor}`, 14, y);
        y += 6;
      }
    }

    if (desglose && desglose.filas.length > 0) {
      y += 4;
      if (y > alturaPagina - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(desglose.titulo, 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const d of desglose.filas) {
        doc.text(`${d.valor}: ${d.cantidad}`, 14, y);
        y += 6;
      }
    }

    doc.save(`reporte-${tipo}-${desde}-a-${hasta}.pdf`);
  }

  return (
    <Modal titulo={config.titulo} onClose={onClose} ancho="1100px">
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -4, marginBottom: 14 }}>
        Período: {desde} a {hasta} — {filas.length} {filas.length === 1 ? "registro" : "registros"}
      </p>
      <div style={{ maxHeight: "55vh", overflow: "auto", marginBottom: 14, border: "1px solid var(--line)", borderRadius: 8 }}>
        <table className="data-table" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              {config.columnas.map((c) => <th key={c} style={{ whiteSpace: "nowrap" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={config.columnas.length} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                  Sin registros en este período.
                </td>
              </tr>
            ) : (
              filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => <td key={j} style={{ whiteSpace: "nowrap" }}>{celda}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totales.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 18,
            padding: "12px 14px",
            background: "var(--paper)",
            borderRadius: 8
          }}
        >
          {totales.map((t) => (
            <div key={t.label} style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {t.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.valor}</div>
            </div>
          ))}
        </div>
      )}

      {desglose && desglose.filas.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{desglose.titulo}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {desglose.filas.map((d) => (
              <div
                key={d.valor}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--paper)",
                  borderRadius: 20,
                  fontSize: 13
                }}
              >
                <span>{d.valor}</span>
                <span className="badge badge-gold">{d.cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={descargarPDF} disabled={filas.length === 0}>
        Descargar PDF
      </button>
    </Modal>
  );
}

function ReportesView() {
  const hoy = new Date();
  const [desde, setDesde] = useState(fechaISO(hoy));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [visitas, setVisitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [consultado, setConsultado] = useState(false);
  const [reporteAbierto, setReporteAbierto] = useState(null);

  async function consultar(e) {
    if (e) e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const inicio = firebase.firestore.Timestamp.fromDate(new Date(desde + "T00:00:00"));
      const fin = firebase.firestore.Timestamp.fromDate(new Date(hasta + "T23:59:59"));
      const snap = await db
        .collection("visitas")
        .where("fechaHoraIngreso", ">=", inicio)
        .where("fechaHoraIngreso", "<=", fin)
        .orderBy("fechaHoraIngreso", "desc")
        .get();
      setVisitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setConsultado(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el reporte. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    consultar();
  }, []);

  function aplicarPreset(preset) {
    const d = new Date();
    if (preset === "hoy") {
      setDesde(fechaISO(d));
      setHasta(fechaISO(d));
    } else if (preset === "semana") {
      const inicioSemana = new Date(d);
      inicioSemana.setDate(d.getDate() - d.getDay());
      setDesde(fechaISO(inicioSemana));
      setHasta(fechaISO(d));
    } else if (preset === "mes") {
      const inicioMes = new Date(d.getFullYear(), d.getMonth(), 1);
      setDesde(fechaISO(inicioMes));
      setHasta(fechaISO(d));
    }
  }

  const totalPersonas = visitas.reduce((acc, v) => acc + (Number(v.cantPasajeros) || 0), 0);
  const totalVehiculos = visitas.length;
  const liberadas = visitas.filter((v) => v.estado === "liberado").length;
  const noLiberadas = visitas.filter((v) => v.estado === "no_liberado").length;
  const enCurso = visitas.filter((v) => v.estado === "en_curso").length;
  const guiasNoLiberados = visitas.filter((v) => v.estado === "no_liberado");

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Reportes</div>
          <h1>Actividad por período</h1>
          <p className="page-desc">Consultá personas y vehículos ingresados, y las visitas que no se liberaron.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-body">
          <form onSubmit={consultar} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </div>
            <button className="btn btn-gold" disabled={cargando} style={{ width: "auto", padding: "11px 20px" }}>
              {cargando ? "Consultando..." : "Consultar"}
            </button>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("hoy")}>Hoy</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("semana")}>Esta semana</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("mes")}>Este mes</button>
            </div>
          </form>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {consultado && (
        <React.Fragment>
          <div className="stat-grid">
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("personas")}
              title="Ver detalle por guía"
            >
              <div className="stat-label">Personas ingresadas</div>
              <div className="stat-value">{totalPersonas}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("vehiculos")}
              title="Ver detalle de vehículos ingresados"
            >
              <div className="stat-label">Vehículos ingresados</div>
              <div className="stat-value">{totalVehiculos}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("liberados")}
              title="Ver detalle de vehículos liberados"
            >
              <div className="stat-label">Liberados</div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{liberadas}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("no_liberados")}
              title="Ver detalle de vehículos no liberados"
            >
              <div className="stat-label">No liberados</div>
              <div className="stat-value" style={{ color: "var(--alert)" }}>{noLiberadas}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
          </div>

          {reporteAbierto && (
            <ModalReporteDetalle
              tipo={reporteAbierto}
              visitas={visitas}
              desde={desde}
              hasta={hasta}
              onClose={() => setReporteAbierto(null)}
            />
          )}

          {enCurso > 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -14, marginBottom: 20 }}>
              Además, {enCurso} {enCurso === 1 ? "visita sigue" : "visitas siguen"} en curso dentro de este período.
            </p>
          )}

          <div className="panel">
            <div className="panel-header">
              <h2>Guías no liberados</h2>
              <span className="badge badge-alert">{guiasNoLiberados.length}</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {guiasNoLiberados.length === 0 ? (
                <div className="empty-state">
                  <div className="display">No hubo visitas sin liberar en este período</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Guía</th>
                      <th>Empresa</th>
                      <th>Vehículo</th>
                      <th>Pasajeros</th>
                      <th>Monto / Mínimo</th>
                      <th>Faltó</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guiasNoLiberados.map((v) => (
                      <tr key={v.id}>
                        <td>{formatearFechaHora(v.fechaHoraIngreso)}</td>
                        <td>{v.guiaNombre}</td>
                        <td>{v.empresaNombre}</td>
                        <td>{v.vehiculoTipoNombre} · {v.chapa}</td>
                        <td>{v.cantPasajeros}</td>
                        <td>$ {Number(v.montoAcumulado || 0).toLocaleString("es-AR")} / $ {Number(v.montoMinimoRequerido || 0).toLocaleString("es-AR")}</td>
                        <td>$ {Math.max(0, (v.montoMinimoRequerido || 0) - (v.montoAcumulado || 0)).toLocaleString("es-AR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista: Reportes de Tienda
// ---------------------------------------------------------------------------

function agruparPersonasPorGuiaTienda(registros) {
  const mapa = new Map();
  for (const r of registros) {
    const key = `${r.guiaNombre || "(sin nombre)"}|${r.tiendaNombre || ""}`;
    if (!mapa.has(key)) {
      mapa.set(key, {
        guia: r.guiaNombre || "(sin nombre)",
        tienda: r.tiendaNombre || "",
        empresa: r.empresaNombre || "",
        visitas: 0,
        pasajeros: 0
      });
    }
    const item = mapa.get(key);
    item.visitas += 1;
    item.pasajeros += Number(r.cantPasajeros) || 0;
  }
  return Array.from(mapa.values()).sort((a, b) => b.pasajeros - a.pasajeros);
}

const REPORTES_TIENDA_DETALLE_CONFIG = {
  personas: {
    titulo: "Personas ingresadas por guía",
    columnas: ["Guía", "Tienda", "Empresa", "Visitas", "Pasajeros"],
    datos: (regs) => agruparPersonasPorGuiaTienda(regs),
    filas: (datos) => datos.map((r) => [r.guia, r.tienda, r.empresa, r.visitas, r.pasajeros]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guia") },
      { label: "Total de Tiendas", valor: contarUnicos(datos, "tienda") },
      { label: "Total de Visitas", valor: datos.reduce((acc, r) => acc + r.visitas, 0) },
      { label: "Total de Pasajeros", valor: datos.reduce((acc, r) => acc + r.pasajeros, 0) }
    ]
  },
  vehiculos: {
    titulo: "Vehículos ingresados",
    columnas: ["Fecha ingreso", "Tienda", "Guía", "Empresa", "Vehículo", "Chapa", "Pasajeros", "Ticket", "Salida"],
    datos: (regs) => regs,
    filas: (datos) => datos.map((r) => [
      formatearFechaHora(r.fechaHoraIngreso),
      r.tiendaNombre,
      r.guiaNombre,
      r.empresaNombre,
      r.vehiculoTipoNombre,
      r.chapa,
      r.cantPasajeros,
      r.ticketEstacionamiento || "—",
      r.fechaHoraSalida ? formatearFechaHora(r.fechaHoraSalida) : "Pendiente"
    ]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guiaNombre") },
      { label: "Total de Tiendas", valor: contarUnicos(datos, "tiendaNombre") },
      { label: "Total de Empresas", valor: contarUnicos(datos, "empresaNombre") },
      { label: "Total de Vehículos", valor: datos.length }
    ],
    desglose: (datos) => ({ titulo: "Por tipo de vehículo", filas: contarPorCampo(datos, "vehiculoTipoNombre") })
  },
  conSalida: {
    titulo: "Con salida registrada",
    columnas: ["Fecha ingreso", "Tienda", "Guía", "Empresa", "Vehículo", "Pasajeros", "Salida"],
    datos: (regs) => regs.filter((r) => r.fechaHoraSalida),
    filas: (datos) => datos.map((r) => [
      formatearFechaHora(r.fechaHoraIngreso),
      r.tiendaNombre,
      r.guiaNombre,
      r.empresaNombre,
      `${r.vehiculoTipoNombre} · ${r.chapa}`,
      r.cantPasajeros,
      formatearFechaHora(r.fechaHoraSalida)
    ]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guiaNombre") },
      { label: "Total de Tiendas", valor: contarUnicos(datos, "tiendaNombre") },
      { label: "Total de Vehículos", valor: datos.length }
    ]
  },
  sinSalida: {
    titulo: "Salida pendiente",
    columnas: ["Fecha ingreso", "Tienda", "Guía", "Empresa", "Vehículo", "Pasajeros"],
    datos: (regs) => regs.filter((r) => !r.fechaHoraSalida),
    filas: (datos) => datos.map((r) => [
      formatearFechaHora(r.fechaHoraIngreso),
      r.tiendaNombre,
      r.guiaNombre,
      r.empresaNombre,
      `${r.vehiculoTipoNombre} · ${r.chapa}`,
      r.cantPasajeros
    ]),
    totales: (datos) => [
      { label: "Total de Guías", valor: contarUnicos(datos, "guiaNombre") },
      { label: "Total de Tiendas", valor: contarUnicos(datos, "tiendaNombre") },
      { label: "Total de Vehículos", valor: datos.length }
    ]
  }
};

function ModalReporteTiendaDetalle({ tipo, registros, desde, hasta, onClose }) {
  const config = REPORTES_TIENDA_DETALLE_CONFIG[tipo];
  const datos = config.datos(registros);
  const filas = config.filas(datos);
  const totales = config.totales ? config.totales(datos) : [];
  const desglose = config.desglose ? config.desglose(datos) : null;

  function descargarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("SHOPPING PARIS", 14, 15);
    doc.setFontSize(11);
    doc.text(config.titulo, 14, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Período: ${desde} a ${hasta} — ${filas.length} ${filas.length === 1 ? "registro" : "registros"}`, 14, 28);
    doc.autoTable({
      startY: 33,
      head: [config.columnas],
      body: filas,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [31, 78, 120], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 243, 237] }
    });

    let y = doc.lastAutoTable.finalY + 10;
    const alturaPagina = doc.internal.pageSize.getHeight();

    if (totales.length > 0) {
      if (y > alturaPagina - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Totales", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const t of totales) {
        doc.text(`${t.label}: ${t.valor}`, 14, y);
        y += 6;
      }
    }

    if (desglose && desglose.filas.length > 0) {
      y += 4;
      if (y > alturaPagina - 20) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(desglose.titulo, 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const d of desglose.filas) {
        doc.text(`${d.valor}: ${d.cantidad}`, 14, y);
        y += 6;
      }
    }

    doc.save(`reporte-tienda-${tipo}-${desde}-a-${hasta}.pdf`);
  }

  return (
    <Modal titulo={config.titulo} onClose={onClose} ancho="1100px">
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -4, marginBottom: 14 }}>
        Período: {desde} a {hasta} — {filas.length} {filas.length === 1 ? "registro" : "registros"}
      </p>
      <div style={{ maxHeight: "55vh", overflow: "auto", marginBottom: 14, border: "1px solid var(--line)", borderRadius: 8 }}>
        <table className="data-table" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              {config.columnas.map((c) => <th key={c} style={{ whiteSpace: "nowrap" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={config.columnas.length} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                  Sin registros en este período.
                </td>
              </tr>
            ) : (
              filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => <td key={j} style={{ whiteSpace: "nowrap" }}>{celda}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totales.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 18,
            padding: "12px 14px",
            background: "var(--paper)",
            borderRadius: 8
          }}
        >
          {totales.map((t) => (
            <div key={t.label} style={{ minWidth: 140 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {t.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t.valor}</div>
            </div>
          ))}
        </div>
      )}

      {desglose && desglose.filas.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{desglose.titulo}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {desglose.filas.map((d) => (
              <div
                key={d.valor}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--paper)",
                  borderRadius: 20,
                  fontSize: 13
                }}
              >
                <span>{d.valor}</span>
                <span className="badge badge-gold">{d.cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={descargarPDF} disabled={filas.length === 0}>
        Descargar PDF
      </button>
    </Modal>
  );
}

function ReportesTiendaView() {
  const hoy = new Date();
  const [desde, setDesde] = useState(fechaISO(hoy));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [tiendaFiltro, setTiendaFiltro] = useState("todas");
  const [tiendas, setTiendas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [consultado, setConsultado] = useState(false);
  const [reporteAbierto, setReporteAbierto] = useState(null);

  useEffect(() => {
    const unsub = db.collection("tiendas").orderBy("nombre").onSnapshot((s) =>
      setTiendas(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  async function consultar(e) {
    if (e) e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const inicio = firebase.firestore.Timestamp.fromDate(new Date(desde + "T00:00:00"));
      const fin = firebase.firestore.Timestamp.fromDate(new Date(hasta + "T23:59:59"));
      const snap = await db
        .collection("registrosTienda")
        .where("fechaHoraIngreso", ">=", inicio)
        .where("fechaHoraIngreso", "<=", fin)
        .orderBy("fechaHoraIngreso", "desc")
        .get();
      let datos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (tiendaFiltro !== "todas") {
        datos = datos.filter((r) => r.tiendaId === tiendaFiltro);
      }
      setRegistros(datos);
      setConsultado(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el reporte. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    consultar();
  }, []);

  function aplicarPreset(preset) {
    const d = new Date();
    if (preset === "hoy") {
      setDesde(fechaISO(d));
      setHasta(fechaISO(d));
    } else if (preset === "semana") {
      const inicioSemana = new Date(d);
      inicioSemana.setDate(d.getDate() - d.getDay());
      setDesde(fechaISO(inicioSemana));
      setHasta(fechaISO(d));
    } else if (preset === "mes") {
      const inicioMes = new Date(d.getFullYear(), d.getMonth(), 1);
      setDesde(fechaISO(inicioMes));
      setHasta(fechaISO(d));
    }
  }

  const totalPersonas = registros.reduce((acc, r) => acc + (Number(r.cantPasajeros) || 0), 0);
  const totalVehiculos = registros.length;
  const conSalida = registros.filter((r) => r.fechaHoraSalida).length;
  const sinSalida = registros.filter((r) => !r.fechaHoraSalida).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Reportes</div>
          <h1>Actividad de Tienda por período</h1>
          <p className="page-desc">Consultá personas y vehículos ingresados desde los puntos de Tienda, aparte de la Sala de Guías.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-body">
          <form onSubmit={consultar} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Tienda</label>
              <select value={tiendaFiltro} onChange={(e) => setTiendaFiltro(e.target.value)}>
                <option value="todas">Todas</option>
                {tiendas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-gold" disabled={cargando} style={{ width: "auto", padding: "11px 20px" }}>
              {cargando ? "Consultando..." : "Consultar"}
            </button>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("hoy")}>Hoy</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("semana")}>Esta semana</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("mes")}>Este mes</button>
            </div>
          </form>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {consultado && (
        <React.Fragment>
          <div className="stat-grid">
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("personas")}
              title="Ver detalle por guía"
            >
              <div className="stat-label">Personas ingresadas</div>
              <div className="stat-value">{totalPersonas}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("vehiculos")}
              title="Ver detalle de vehículos ingresados"
            >
              <div className="stat-label">Vehículos ingresados</div>
              <div className="stat-value">{totalVehiculos}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("conSalida")}
              title="Ver detalle de los que ya tienen salida registrada"
            >
              <div className="stat-label">Con salida registrada</div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{conSalida}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
            <div
              className="stat-card"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => setReporteAbierto("sinSalida")}
              title="Ver detalle de los que todavía no tienen salida"
            >
              <div className="stat-label">Salida pendiente</div>
              <div className="stat-value" style={{ color: "var(--alert)" }}>{sinSalida}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Ver detalle →</div>
            </div>
          </div>

          {reporteAbierto && (
            <ModalReporteTiendaDetalle
              tipo={reporteAbierto}
              registros={registros}
              desde={desde}
              hasta={hasta}
              onClose={() => setReporteAbierto(null)}
            />
          )}
        </React.Fragment>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista: Ranking de guías y fidelidad
// ---------------------------------------------------------------------------

const PESOS_FIDELIDAD_POR_DEFECTO = { pesoPasajeros: 1, pesoVisitas: 5, pesoMonto: 0.001 };

function RankingView({ perfil }) {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = useState(fechaISO(inicioMes));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [visitas, setVisitas] = useState([]);
  const [pesos, setPesos] = useState(PESOS_FIDELIDAD_POR_DEFECTO);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [consultado, setConsultado] = useState(false);
  const [modalPesos, setModalPesos] = useState(false);

  useEffect(() => {
    db.collection("config").doc("fidelidad").get().then((doc) => {
      if (doc.exists) setPesos({ ...PESOS_FIDELIDAD_POR_DEFECTO, ...doc.data() });
    });
  }, []);

  async function consultar(e) {
    if (e) e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const inicio = firebase.firestore.Timestamp.fromDate(new Date(desde + "T00:00:00"));
      const fin = firebase.firestore.Timestamp.fromDate(new Date(hasta + "T23:59:59"));
      // Se trae todo el rango (sin filtrar por estado en la consulta) para no
      // requerir un índice compuesto en Firestore; el filtro de "liberado" se
      // hace acá mismo, del lado del cliente.
      const snap = await db
        .collection("visitas")
        .where("fechaHoraIngreso", ">=", inicio)
        .where("fechaHoraIngreso", "<=", fin)
        .get();
      setVisitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => v.estado === "liberado"));
      setConsultado(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el ranking. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    consultar();
  }, []);

  function aplicarPreset(preset) {
    const d = new Date();
    if (preset === "mes") {
      setDesde(fechaISO(new Date(d.getFullYear(), d.getMonth(), 1)));
      setHasta(fechaISO(d));
    } else if (preset === "trimestre") {
      setDesde(fechaISO(new Date(d.getFullYear(), d.getMonth() - 2, 1)));
      setHasta(fechaISO(d));
    } else if (preset === "año") {
      setDesde(fechaISO(new Date(d.getFullYear(), 0, 1)));
      setHasta(fechaISO(d));
    }
  }

  const ranking = React.useMemo(() => {
    const porGuia = {};
    visitas.forEach((v) => {
      if (!porGuia[v.guiaId]) {
        porGuia[v.guiaId] = { guiaId: v.guiaId, guiaNombre: v.guiaNombre, empresaNombre: v.empresaNombre || "", pasajeros: 0, visitas: 0, monto: 0 };
      }
      porGuia[v.guiaId].pasajeros += Number(v.cantPasajeros) || 0;
      porGuia[v.guiaId].visitas += 1;
      porGuia[v.guiaId].monto += Number(v.montoAcumulado) || 0;
    });
    return Object.values(porGuia)
      .map((g) => ({
        ...g,
        puntaje: g.pasajeros * pesos.pesoPasajeros + g.visitas * pesos.pesoVisitas + g.monto * pesos.pesoMonto
      }))
      .sort((a, b) => b.puntaje - a.puntaje);
  }, [visitas, pesos]);

  const medallas = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Fidelidad</div>
          <h1>Ranking de guías</h1>
          <p className="page-desc">Puntaje combinado según pasajeros, visitas y compras — solo cuentan las visitas liberadas.</p>
        </div>
        {tienePermiso(perfil, "gestionar_catalogos") && (
          <button className="btn btn-ghost" onClick={() => setModalPesos(true)}>Configurar pesos</button>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-body">
          <form onSubmit={consultar} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </div>
            <button className="btn btn-gold" disabled={cargando} style={{ width: "auto", padding: "11px 20px" }}>
              {cargando ? "Consultando..." : "Consultar"}
            </button>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("mes")}>Este mes</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("trimestre")}>Últimos 3 meses</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("año")}>Este año</button>
            </div>
          </form>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {consultado && (
        <div className="panel">
          <div className="panel-body" style={{ padding: 0 }}>
            {ranking.length === 0 ? (
              <div className="empty-state">
                <div className="display">No hay visitas liberadas en este período</div>
                <p>El ranking se arma solo con visitas que llegaron al monto mínimo.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Guía</th>
                    <th>Empresa</th>
                    <th>Pasajeros</th>
                    <th>Visitas</th>
                    <th>Compras</th>
                    <th>Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((g, i) => (
                    <tr key={g.guiaId}>
                      <td style={{ fontSize: 18 }}>{medallas[i] || i + 1}</td>
                      <td>{g.guiaNombre}</td>
                      <td>{g.empresaNombre}</td>
                      <td>{g.pasajeros}</td>
                      <td>{g.visitas}</td>
                      <td>$ {g.monto.toLocaleString("es-AR")}</td>
                      <td><span className="badge badge-gold">{Math.round(g.puntaje).toLocaleString("es-AR")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modalPesos && (
        <ModalPesosFidelidad
          pesos={pesos}
          onGuardado={(nuevos) => setPesos(nuevos)}
          onClose={() => setModalPesos(false)}
        />
      )}
    </div>
  );
}

function ModalPesosFidelidad({ pesos, onGuardado, onClose }) {
  const [pesoPasajeros, setPesoPasajeros] = useState(pesos.pesoPasajeros);
  const [pesoVisitas, setPesoVisitas] = useState(pesos.pesoVisitas);
  const [pesoMonto, setPesoMonto] = useState(pesos.pesoMonto);
  const [cargando, setCargando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setCargando(true);
    try {
      const nuevos = {
        pesoPasajeros: Number(pesoPasajeros) || 0,
        pesoVisitas: Number(pesoVisitas) || 0,
        pesoMonto: Number(pesoMonto) || 0
      };
      await db.collection("config").doc("fidelidad").set(nuevos);
      onGuardado(nuevos);
      onClose();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal
      titulo="Configurar pesos de fidelidad"
      onClose={onClose}
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={guardar} disabled={cargando}>
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </React.Fragment>
      }
    >
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        Puntaje = (pasajeros × peso) + (visitas × peso) + (monto de compras × peso).
        Ajustá los pesos según qué factor querés que pese más en el ranking.
      </p>
      <form onSubmit={guardar}>
        <div className="field">
          <label>Peso por pasajero</label>
          <input type="number" step="0.01" value={pesoPasajeros} onChange={(e) => setPesoPasajeros(e.target.value)} required />
        </div>
        <div className="field">
          <label>Peso por visita liberada</label>
          <input type="number" step="0.01" value={pesoVisitas} onChange={(e) => setPesoVisitas(e.target.value)} required />
        </div>
        <div className="field">
          <label>Peso por monto de compra (por unidad de $)</label>
          <input type="number" step="0.0001" value={pesoMonto} onChange={(e) => setPesoMonto(e.target.value)} required />
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista: Mapa de calor de afluencia
// ---------------------------------------------------------------------------

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ORDEN_DIA_JS = [1, 2, 3, 4, 5, 6, 0]; // reordena getDay() (0=Dom) para empezar en lunes
const HORAS_MAPA = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 a 21:00
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

// Arma la grilla de un mes calendario (semanas de lunes a domingo, con
// celdas vacías al inicio/fin para completar la primera y última semana).
// Cada celda marca si cae dentro del rango consultado ("enRango") para
// pintarla distinto de los días del mes que quedaron fuera del período.
function construirCalendarioMes(anio, mes, ingresosPorFecha, desdeDate, hastaDate) {
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const offsetInicio = (primerDia.getDay() + 6) % 7; // lunes=0 ... domingo=6
  const celdas = [];
  for (let i = 0; i < offsetInicio; i++) celdas.push(null);
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const fecha = new Date(anio, mes, dia);
    const iso = fechaISO(fecha);
    const enRango = fecha >= desdeDate && fecha <= hastaDate;
    celdas.push({ dia, iso, valor: ingresosPorFecha[iso] || 0, enRango });
  }
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

function MapaCalorView() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = useState(fechaISO(inicioMes));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [visitas, setVisitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [consultado, setConsultado] = useState(false);

  async function consultar(e) {
    if (e) e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const inicio = firebase.firestore.Timestamp.fromDate(new Date(desde + "T00:00:00"));
      const fin = firebase.firestore.Timestamp.fromDate(new Date(hasta + "T23:59:59"));
      const snap = await db
        .collection("visitas")
        .where("fechaHoraIngreso", ">=", inicio)
        .where("fechaHoraIngreso", "<=", fin)
        .get();
      setVisitas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setConsultado(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo generar el mapa de calor. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    consultar();
  }, []);

  function aplicarPreset(preset) {
    const d = new Date();
    if (preset === "mes") {
      setDesde(fechaISO(new Date(d.getFullYear(), d.getMonth(), 1)));
      setHasta(fechaISO(d));
    } else if (preset === "trimestre") {
      setDesde(fechaISO(new Date(d.getFullYear(), d.getMonth() - 2, 1)));
      setHasta(fechaISO(d));
    } else if (preset === "año") {
      setDesde(fechaISO(new Date(d.getFullYear(), 0, 1)));
      setHasta(fechaISO(d));
    }
  }

  const matriz = React.useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(HORAS_MAPA.length).fill(0));
    visitas.forEach((v) => {
      if (!v.fechaHoraIngreso) return;
      const fecha = v.fechaHoraIngreso.toDate ? v.fechaHoraIngreso.toDate() : new Date(v.fechaHoraIngreso);
      const filaDia = ORDEN_DIA_JS.indexOf(fecha.getDay());
      const colHora = HORAS_MAPA.indexOf(fecha.getHours());
      if (filaDia >= 0 && colHora >= 0) m[filaDia][colHora] += 1;
    });
    return m;
  }, [visitas]);

  const maximo = Math.max(1, ...matriz.flat());

  let pico = null;
  matriz.forEach((fila, i) => {
    fila.forEach((valor, j) => {
      if (!pico || valor > pico.valor) pico = { valor, dia: DIAS_SEMANA[i], hora: HORAS_MAPA[j] };
    });
  });

  // --- Afluencia por fecha exacta (calendario mensual) ---
  const ingresosPorFecha = React.useMemo(() => {
    const mapa = {};
    visitas.forEach((v) => {
      if (!v.fechaHoraIngreso) return;
      const fecha = v.fechaHoraIngreso.toDate ? v.fechaHoraIngreso.toDate() : new Date(v.fechaHoraIngreso);
      const iso = fechaISO(fecha);
      mapa[iso] = (mapa[iso] || 0) + 1;
    });
    return mapa;
  }, [visitas]);

  const desdeDate = new Date(desde + "T00:00:00");
  const hastaDate = new Date(hasta + "T00:00:00");

  const mesesEnRango = React.useMemo(() => {
    const meses = [];
    let cursor = new Date(desdeDate.getFullYear(), desdeDate.getMonth(), 1);
    const fin = new Date(hastaDate.getFullYear(), hastaDate.getMonth(), 1);
    while (cursor <= fin) {
      meses.push({ anio: cursor.getFullYear(), mes: cursor.getMonth() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return meses;
  }, [desde, hasta]);

  const maximoPorDia = Math.max(1, ...Object.values(ingresosPorFecha));

  let picoDia = null;
  Object.entries(ingresosPorFecha).forEach(([iso, valor]) => {
    const fecha = new Date(iso + "T00:00:00");
    if (fecha < desdeDate || fecha > hastaDate) return;
    if (!picoDia || valor > picoDia.valor) picoDia = { iso, valor };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Afluencia</div>
          <h1>Mapa de calor</h1>
          <p className="page-desc">Ingresos por día de la semana y horario (8:00 a 22:00), para identificar los momentos de mayor afluencia.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-body">
          <form onSubmit={consultar} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
            </div>
            <button className="btn btn-gold" disabled={cargando} style={{ width: "auto", padding: "11px 20px" }}>
              {cargando ? "Consultando..." : "Consultar"}
            </button>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("mes")}>Este mes</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("trimestre")}>Últimos 3 meses</button>
              <button type="button" className="btn btn-ghost" onClick={() => aplicarPreset("año")}>Este año</button>
            </div>
          </form>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {consultado && (
        <React.Fragment>
          {pico && pico.valor > 0 && (
            <div className="ticket" style={{ marginBottom: 20 }}>
              <div className="ticket-stub">PICO</div>
              <div className="ticket-perforation"></div>
              <div className="ticket-body">
                <h3 style={{ fontSize: 15 }}>Mayor afluencia</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                  {pico.dia} de {pico.hora}:00 a {pico.hora + 1}:00 — {pico.valor} {pico.valor === 1 ? "ingreso" : "ingresos"}
                </p>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-body" style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th></th>
                    {HORAS_MAPA.map((h) => (
                      <th key={h} style={{ padding: "4px 2px", color: "var(--text-muted)", fontWeight: 600 }}>{h}h</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DIAS_SEMANA.map((dia, i) => (
                    <tr key={dia}>
                      <td style={{ padding: "4px 8px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{dia}</td>
                      {matriz[i].map((valor, j) => {
                        const intensidad = valor > 0 ? 0.12 + 0.8 * (valor / maximo) : 0.05;
                        return (
                          <td
                            key={j}
                            title={`${dia} ${HORAS_MAPA[j]}:00 — ${valor} ${valor === 1 ? "ingreso" : "ingresos"}`}
                            style={{
                              background: `rgba(184, 147, 95, ${intensidad})`,
                              color: intensidad > 0.55 ? "#fff" : "var(--ink)",
                              textAlign: "center",
                              padding: "8px 4px",
                              minWidth: 26,
                              borderRadius: 3
                            }}
                          >
                            {valor > 0 ? valor : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, fontSize: 12, color: "var(--text-muted)" }}>
                <span>Menor afluencia</span>
                <div style={{ display: "flex", height: 10, width: 120, borderRadius: 4, overflow: "hidden" }}>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map((op) => (
                    <div key={op} style={{ flex: 1, background: `rgba(184, 147, 95, ${op})` }}></div>
                  ))}
                </div>
                <span>Mayor afluencia</span>
              </div>
            </div>
          </div>

          {picoDia && picoDia.valor > 0 && (
            <div className="ticket" style={{ marginTop: 20, marginBottom: 20 }}>
              <div className="ticket-stub">PICO</div>
              <div className="ticket-perforation"></div>
              <div className="ticket-body">
                <h3 style={{ fontSize: 15 }}>Día de mayor afluencia</h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                  {new Date(picoDia.iso + "T00:00:00").toLocaleDateString("es-PY", { weekday: "long", day: "numeric", month: "long" })}
                  {" — "}{picoDia.valor} {picoDia.valor === 1 ? "ingreso" : "ingresos"}
                </p>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-body">
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>Afluencia por día</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>
                Total de ingresos en cada fecha exacta del período consultado.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
                {mesesEnRango.map(({ anio, mes }) => {
                  const semanas = construirCalendarioMes(anio, mes, ingresosPorFecha, desdeDate, hastaDate);
                  return (
                    <div key={`${anio}-${mes}`}>
                      <div style={{ fontWeight: 600, marginBottom: 8, textTransform: "capitalize", fontSize: 13 }}>
                        {MESES_LARGOS[mes]} {anio}
                      </div>
                      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr>
                            {DIAS_SEMANA.map((d) => (
                              <th key={d} style={{ padding: "2px 4px", color: "var(--text-muted)", fontWeight: 600 }}>
                                {d.charAt(0)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {semanas.map((semana, si) => (
                            <tr key={si}>
                              {semana.map((celda, ci) => {
                                if (!celda) return <td key={ci} style={{ padding: "6px 4px" }}></td>;
                                const intensidad = celda.enRango
                                  ? (celda.valor > 0 ? 0.12 + 0.8 * (celda.valor / maximoPorDia) : 0.05)
                                  : 0.02;
                                return (
                                  <td
                                    key={ci}
                                    title={`${celda.iso} — ${celda.valor} ${celda.valor === 1 ? "ingreso" : "ingresos"}${celda.enRango ? "" : " (fuera del período consultado)"}`}
                                    style={{
                                      background: `rgba(184, 147, 95, ${intensidad})`,
                                      color: celda.enRango ? (intensidad > 0.55 ? "#fff" : "var(--ink)") : "var(--text-muted)",
                                      textAlign: "center",
                                      padding: "6px 4px",
                                      minWidth: 26,
                                      borderRadius: 3,
                                      opacity: celda.enRango ? 1 : 0.45
                                    }}
                                  >
                                    {celda.dia}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista: Configuración (logo del shopping)
// ---------------------------------------------------------------------------

function ConfiguracionView({ mostrarToast }) {
  const [logoUrl, setLogoUrl] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = db.collection("config").doc("branding").onSnapshot((doc) => {
      setLogoUrl(doc.exists ? doc.data().logoUrl : null);
    });
    return () => unsub();
  }, []);

  async function subirLogo(e) {
    const archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si hace falta
    if (!archivo) return;

    setError("");
    const tiposValidos = ["image/png", "image/jpeg", "image/jpg"];
    if (!tiposValidos.includes(archivo.type)) {
      setError("El logo tiene que ser un archivo JPG o PNG.");
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setError("El archivo pesa más de 2MB. Subí una imagen más liviana.");
      return;
    }

    setSubiendo(true);
    try {
      const extension = archivo.type === "image/png" ? "png" : "jpg";
      const ref = storage.ref(`logo/logo.${extension}`);
      await ref.put(archivo);
      const url = await ref.getDownloadURL();
      await db.collection("config").doc("branding").set({ logoUrl: url });
      mostrarToast("Logo actualizado.");
    } catch (err) {
      console.error(err);
      setError("No se pudo subir el logo. Probá de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Configuración</div>
          <h1>Logo del shopping</h1>
          <p className="page-desc">Se muestra en el menú lateral y en el encabezado del ticket de liberación en PDF.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          {error && <div className="form-error">{error}</div>}

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo actual" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)" }} />
            ) : (
              <div className="brand-logo-placeholder" style={{ width: 72, height: 72, fontSize: 22 }}>SP</div>
            )}
            <div>
              <p style={{ fontSize: 14, marginBottom: 4 }}>{logoUrl ? "Logo actual" : "Todavía no se subió un logo"}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Formato JPG o PNG, hasta 2MB.</p>
            </div>
          </div>

          <label className="btn btn-gold" style={{ width: "auto", padding: "11px 20px", display: "inline-block", cursor: "pointer" }}>
            {subiendo ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={subirLogo}
              disabled={subiendo}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell principal (sidebar + contenido)
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: "panel", label: "Panel", icon: "◆", permiso: null },
  { id: "visitas", label: "Visitas", icon: "◈", permiso: "registrar_visitas" },
  { id: "tienda", label: "Tienda", icon: "◈", permiso: "registrar_visitas" },
  { id: "guias", label: "Guías", icon: "◈", permiso: "registrar_visitas" },
  { id: "ranking", label: "Ranking", icon: "◈", permiso: "ver_reportes" },
  { id: "mapaCalor", label: "Mapa de calor", icon: "◈", permiso: "ver_reportes" },
  { id: "reportes", label: "Reportes", icon: "◈", permiso: "ver_reportes" },
  { id: "reportesTienda", label: "Reportes Tienda", icon: "◈", permiso: "ver_reportes" },
  { id: "usuarios", label: "Usuarios y roles", icon: "◈", permiso: "gestionar_usuarios" },
  { id: "empresas", label: "Empresas", icon: "◇", permiso: "gestionar_catalogos" },
  { id: "vehiculos", label: "Tipos de vehículo", icon: "◇", permiso: "gestionar_catalogos" },
  { id: "tiendas", label: "Tiendas", icon: "◇", permiso: "gestionar_catalogos" },
  { id: "configuracion", label: "Configuración", icon: "◇", permiso: "gestionar_catalogos" }
];

function Shell({ perfil }) {
  const [vista, setVista] = useState("panel");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [logoUrl, setLogoUrl] = useState(null);
  const [sidebarColapsado, setSidebarColapsado] = useState(() => {
    try {
      return localStorage.getItem("spx_sidebarColapsado") === "true";
    } catch (err) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("spx_sidebarColapsado", String(sidebarColapsado));
    } catch (err) {
      // localStorage puede fallar en modo incógnito estricto; no es crítico.
    }
  }, [sidebarColapsado]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const unsub = db.collection("config").doc("branding").onSnapshot((doc) => {
      setLogoUrl(doc.exists ? doc.data().logoUrl : null);
    });
    return () => unsub();
  }, []);

  const mostrarToast = useCallback((msg) => setToast(msg), []);

  // Un usuario con tiendas asignadas (perfil.tiendaIds) entra por "Tienda" y
  // no ve "Visitas" — eso es exclusivo de la sala de guías. El resto de los
  // ítems se filtra solo por permiso, como siempre.
  const tieneTiendaAsignada = (perfil.tiendaIds || []).length > 0;
  const itemsVisibles = NAV_ITEMS.filter((i) => {
    if (i.permiso && !tienePermiso(perfil, i.permiso)) return false;
    if (i.id === "visitas" && tieneTiendaAsignada) return false;
    if (i.id === "tienda" && !tieneTiendaAsignada) return false;
    return true;
  });

  function renderVista() {
    if (vista === "visitas" && tienePermiso(perfil, "registrar_visitas") && !tieneTiendaAsignada) {
      return <VisitasView perfil={perfil} mostrarToast={mostrarToast} />;
    }
    if (vista === "tienda" && tienePermiso(perfil, "registrar_visitas") && tieneTiendaAsignada) {
      return <TiendaView perfil={perfil} mostrarToast={mostrarToast} />;
    }
    if (vista === "reportes" && tienePermiso(perfil, "ver_reportes")) {
      return <ReportesView />;
    }
    if (vista === "reportesTienda" && tienePermiso(perfil, "ver_reportes")) {
      return <ReportesTiendaView />;
    }
    if (vista === "guias" && tienePermiso(perfil, "registrar_visitas")) {
      return <GuiasView mostrarToast={mostrarToast} />;
    }
    if (vista === "ranking" && tienePermiso(perfil, "ver_reportes")) {
      return <RankingView perfil={perfil} />;
    }
    if (vista === "mapaCalor" && tienePermiso(perfil, "ver_reportes")) {
      return <MapaCalorView />;
    }
    if (vista === "configuracion" && tienePermiso(perfil, "gestionar_catalogos")) {
      return <ConfiguracionView mostrarToast={mostrarToast} />;
    }
    if (vista === "usuarios" && tienePermiso(perfil, "gestionar_usuarios")) {
      return <UsuariosView mostrarToast={mostrarToast} />;
    }
    if (vista === "empresas" && tienePermiso(perfil, "gestionar_catalogos")) {
      return (
        <CatalogoView
          titulo="Empresas"
          descripcion="Empresas de turismo que prestan servicio con guías propios."
          coleccion="empresas"
          campos={[{ id: "nombre", label: "Nombre" }]}
          mostrarToast={mostrarToast}
        />
      );
    }
    if (vista === "vehiculos" && tienePermiso(perfil, "gestionar_catalogos")) {
      return (
        <CatalogoView
          titulo="Tipos de vehículo"
          descripcion="Definí el monto mínimo de compra requerido para liberar el estacionamiento."
          coleccion="tiposVehiculo"
          campos={[
            { id: "nombre", label: "Tipo de vehículo" },
            { id: "montoMinimoCompra", label: "Monto mínimo", tipo: "moneda" }
          ]}
          mostrarToast={mostrarToast}
        />
      );
    }
    if (vista === "tiendas" && tienePermiso(perfil, "gestionar_catalogos")) {
      return (
        <CatalogoView
          titulo="Tiendas"
          descripcion="Tiendas del shopping que cargan sus propios registros, aparte de la sala de guías."
          coleccion="tiendas"
          campos={[{ id: "nombre", label: "Nombre" }]}
          mostrarToast={mostrarToast}
        />
      );
    }
    return <PanelInicio perfil={perfil} />;
  }

  return (
    <div className={`shell ${sidebarColapsado ? "sidebar-colapsado" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="brand-logo" />
          ) : (
            <div className="brand-logo-placeholder">SP</div>
          )}
          <div className="brand-text">
            <div className="brand-title">Shopping Paris</div>
            <div className="brand-sub">Sala de Guías</div>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarColapsado((v) => !v)}
            title={sidebarColapsado ? "Expandir menú" : "Replegar menú"}
            aria-label="Alternar menú"
          >
            {sidebarColapsado ? "»" : "«"}
          </button>
        </div>

        <nav className="nav">
          {itemsVisibles.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${vista === item.id ? "active" : ""}`}
              onClick={() => setVista(item.id)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="dot"></span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{iniciales(perfil.nombre)}</div>
            <div className="user-info">
              <div className="user-name">{perfil.nombre}</div>
              <div className="user-role">{perfil.rolNombre}</div>
            </div>
          </div>
          <button className="link-muted" onClick={() => auth.signOut()} title="Cerrar sesión">
            {sidebarColapsado ? "⏻" : "Cerrar sesión"}
          </button>
          {!sidebarColapsado && (
            <div style={{ fontSize: 11, color: "rgba(240, 238, 232, 0.35)", marginTop: 10 }}>v1.17</div>
          )}
        </div>
      </aside>

      <main className="main">
        {!online && <div className="offline-banner">Sin conexión — los cambios se guardan y sincronizan al reconectar.</div>}
        {renderVista()}
      </main>

      <Toast mensaje={toast} onClose={() => setToast("")} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// App raíz: decide entre Setup inicial / Login / Shell
// ---------------------------------------------------------------------------

function App() {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [necesitaSetup, setNecesitaSetup] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);

  const [errorConexion, setErrorConexion] = useState("");

  // Verifica si hace falta el setup inicial. Se consulta config/meta (de
  // lectura pública) en vez de /usuarios, porque todavía no hay sesión y
  // las reglas de seguridad no permiten leer /usuarios sin estar logueado.
  useEffect(() => {
    db.collection("config").doc("meta").get()
      .then((doc) => {
        const completo = doc.exists && doc.data().setupCompleto === true;
        setNecesitaSetup(!completo);
        setCargandoInicial(false);
      })
      .catch((err) => {
        console.error(err);
        setErrorConexion(
          "No se pudo conectar con la base de datos. Verificá que Firestore " +
          "esté creado en Firebase Console y que firebase-config.js tenga las " +
          "credenciales correctas. (" + err.code + ")"
        );
        setCargandoInicial(false);
      });
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setAuthUser(user);
      if (!user) {
        setPerfil(null);
        setCargandoAuth(false);
        return;
      }
      const doc = await db.collection("usuarios").doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        let rolNombre = "Sin rol";
        let permisos = [];
        if (data.rolId) {
          const rolDoc = await db.collection("roles").doc(data.rolId).get();
          if (rolDoc.exists) {
            rolNombre = rolDoc.data().nombre;
            permisos = rolDoc.data().permisos || [];
          }
        }
        setPerfil({ id: doc.id, ...data, rolNombre, permisos });
      }
      setCargandoAuth(false);
    });
    return () => unsub();
  }, []);

  if (cargandoInicial || cargandoAuth) {
    return <div className="center-loading">Cargando…</div>;
  }

  if (errorConexion) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-eyebrow">Error de conexión</div>
          <h1>No se pudo conectar</h1>
          <div className="form-error">{errorConexion}</div>
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (necesitaSetup) {
    return <SetupInicial />;
  }

  if (!authUser || !perfil) {
    return <Login />;
  }

  return <Shell perfil={perfil} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
