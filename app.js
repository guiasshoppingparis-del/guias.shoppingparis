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
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
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

function Modal({ titulo, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
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
        <div className="ticket-stub">v0.2</div>
        <div className="ticket-perforation"></div>
        <div className="ticket-body">
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>Roadmap del sistema</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 10 }}>
            Ya se puede registrar el ingreso de guías con escaneo del ticket de estacionamiento.
            Las próximas versiones suman liberación de estacionamiento, cierre de día, reportes,
            ranking de guías y mapa de calor.
          </p>
          <span className="badge badge-gold">Próximo: v0.3 — Liberación de estacionamiento</span>
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
    return () => {
      u();
      r();
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

function ModalUsuario({ usuario, roles, onClose, mostrarToast }) {
  const esNuevo = !usuario.id;
  const [nombre, setNombre] = useState(usuario.nombre || "");
  const [email, setEmail] = useState(usuario.email || "");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState(usuario.rolId || (roles[0] && roles[0].id) || "");
  const [activo, setActivo] = useState(usuario.activo !== false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

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
          activo,
          creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        await secondaryAuth.signOut();
        mostrarToast("Usuario creado. Ya puede ingresar con su email y contraseña.");
      } else {
        await db.collection("usuarios").doc(usuario.id).update({ nombre, rolId, activo });
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
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
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
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
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
// Escaneo de ticket de estacionamiento (QR / código de barras)
// ---------------------------------------------------------------------------

function EscanerTicket({ onDetectado, onClose }) {
  const [error, setError] = useState("");
  const [buscandoCamara, setBuscandoCamara] = useState(true);

  useEffect(() => {
    let activo = true;
    const scanner = new Html5Qrcode("lector-qr");

    Html5Qrcode.getCameras()
      .then((camaras) => {
        if (!activo) return;
        if (!camaras || camaras.length === 0) {
          setError("No se encontró ninguna cámara disponible en este dispositivo.");
          setBuscandoCamara(false);
          return;
        }
        // En celulares, la última cámara de la lista suele ser la trasera.
        const camaraId = camaras[camaras.length - 1].id;
        setBuscandoCamara(false);
        scanner
          .start(
            camaraId,
            { fps: 10, qrbox: { width: 240, height: 160 } },
            (textoDetectado) => {
              if (!activo) return;
              activo = false;
              scanner
                .stop()
                .then(() => scanner.clear())
                .catch(() => {});
              onDetectado(textoDetectado.trim());
            },
            () => {
              /* frames sin detección: se ignoran, es normal mientras se enfoca */
            }
          )
          .catch((err) => {
            setError("No se pudo acceder a la cámara. Revisá los permisos del navegador.");
            console.error(err);
          });
      })
      .catch((err) => {
        setError("No se pudo acceder a la cámara. Revisá los permisos del navegador.");
        setBuscandoCamara(false);
        console.error(err);
      });

    return () => {
      activo = false;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, []);

  return (
    <Modal titulo="Escanear ticket de estacionamiento" onClose={onClose}>
      {error && <div className="form-error">{error}</div>}
      {buscandoCamara && !error && <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Buscando cámara…</p>}
      <div id="lector-qr"></div>
      {!error && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>
          Apuntá la cámara al código de barras o QR del ticket de estacionamiento.
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Vista: Visitas (ingreso de guías a la sala)
// ---------------------------------------------------------------------------

function tiempoTranscurrido(fecha) {
  if (!fecha) return "—";
  const inicio = fecha.toDate ? fecha.toDate() : new Date(fecha);
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

  // Refresca el "tiempo transcurrido" de cada tarjeta cada 30 segundos.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

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
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 18 }}>Visitas en curso</h2>
          <span className="badge badge-gold">{visitasEnCurso.length}</span>
        </div>

        {visitasEnCurso.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <div className="display">No hay guías en la sala en este momento</div>
              <p>Los ingresos que registres van a aparecer acá.</p>
            </div>
          </div>
        ) : (
          <div className="ticket-grid">
            {visitasEnCurso.map((v) => (
              <div className="ticket" key={v.id}>
                <div className="ticket-stub">{tiempoTranscurrido(v.fechaHoraIngreso)}</div>
                <div className="ticket-perforation"></div>
                <div className="ticket-body">
                  <h3 style={{ fontSize: 16 }}>{v.guiaNombre}</h3>
                  <div className="ticket-meta">
                    <span><strong>Empresa:</strong> {v.empresaNombre}</span>
                    <span><strong>Vehículo:</strong> {v.vehiculoTipoNombre} · {v.chapa}</span>
                    <span><strong>Pasajeros:</strong> {v.cantPasajeros}</span>
                    <span><strong>Ticket:</strong> {v.ticketEstacionamiento}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const [mostrarEscaner, setMostrarEscaner] = useState(false);
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
    setNombreGuia(valor);
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
  }

  async function registrarIngreso(e) {
    e.preventDefault();
    setError("");
    if (!nombreGuia.trim() || !empresaId || !vehiculoTipoId || !chapa.trim() || !ticket.trim() || !cantPasajeros) {
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
        fechaHoraIngreso: firebase.firestore.FieldValue.serverTimestamp(),
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
              <input value={chapa} onChange={(e) => setChapa(e.target.value)} placeholder="AB 123 CD" required />
            </div>
          </div>

          <div className="field">
            <label>Ticket de estacionamiento</label>
            <div className="scan-row">
              <input
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                placeholder="Escaneá o escribí el número"
                required
              />
              <button type="button" className="btn btn-ghost" onClick={() => setMostrarEscaner(true)}>
                📷 Escanear
              </button>
            </div>
          </div>

          <button className="btn btn-primary" disabled={cargando} style={{ width: "auto", padding: "11px 24px" }}>
            {cargando ? "Registrando..." : "Registrar ingreso"}
          </button>
        </form>
      </div>

      {mostrarEscaner && (
        <EscanerTicket
          onDetectado={(texto) => {
            setTicket(texto);
            setMostrarEscaner(false);
          }}
          onClose={() => setMostrarEscaner(false)}
        />
      )}
    </div>
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
              onChange={(e) => set(c.id, e.target.value)}
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
// Shell principal (sidebar + contenido)
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: "panel", label: "Panel", icon: "◆", permiso: null },
  { id: "visitas", label: "Visitas", icon: "◈", permiso: "registrar_visitas" },
  { id: "usuarios", label: "Usuarios y roles", icon: "◈", permiso: "gestionar_usuarios" },
  { id: "empresas", label: "Empresas", icon: "◇", permiso: "gestionar_catalogos" },
  { id: "vehiculos", label: "Tipos de vehículo", icon: "◇", permiso: "gestionar_catalogos" }
];

function Shell({ perfil }) {
  const [vista, setVista] = useState("panel");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

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

  const mostrarToast = useCallback((msg) => setToast(msg), []);

  const itemsVisibles = NAV_ITEMS.filter((i) => !i.permiso || tienePermiso(perfil, i.permiso));

  function renderVista() {
    if (vista === "visitas" && tienePermiso(perfil, "registrar_visitas")) {
      return <VisitasView perfil={perfil} mostrarToast={mostrarToast} />;
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
    return <PanelInicio perfil={perfil} />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo-placeholder">SP</div>
          <div className="brand-text">
            <div className="brand-title">Shopping Paris</div>
            <div className="brand-sub">Sala de Guías</div>
          </div>
        </div>

        <nav className="nav">
          {itemsVisibles.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${vista === item.id ? "active" : ""}`}
              onClick={() => setVista(item.id)}
            >
              <span className="dot"></span>
              {item.label}
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
          <button className="link-muted" onClick={() => auth.signOut()}>Cerrar sesión</button>
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
