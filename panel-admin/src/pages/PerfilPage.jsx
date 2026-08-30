import { useRef, useState } from "react";
import ImageCropModal from "../components/ImageCropModal.jsx";
import { updateMyProfile } from "../services/api.js";

export default function PerfilPage({ user, onUpdated }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    nombre: user.nombre || "",
    correo: user.correo || "",
    telefono: user.telefono || "",
    contactoEmergencia: user.contactoEmergencia || "",
    avatarUrl: user.avatarUrl || ""
  });
  const [cropSource, setCropSource] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  function selectImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1200000) {
      setMessage("La foto debe pesar menos de 1.2 MB.");
      setMessageType("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function save(event) {
    event.preventDefault();
    try {
      const result = await updateMyProfile(form);
      onUpdated?.(result.data);
      setMessage(result.message || "Perfil actualizado correctamente.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    }
  }

  return (
    <section className="module-page profile-settings-page">
      <header className="module-header">
        <div>
          <span className="module-label">Configuración</span>
          <h1>Personalización de Perfil</h1>
          <p>Gestiona tus datos personales, foto de perfil y contacto de emergencia para siniestros.</p>
        </div>
      </header>

      {message && (
        <p className={`module-message module-message-${messageType}`}>
          {message}
        </p>
      )}

      <form className="profile-form-container" onSubmit={save}>
        {/* Tarjeta de Foto de Perfil */}
        <aside className="profile-avatar-card">
          <div className="profile-avatar-wrapper">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="Foto de perfil" />
            ) : (
              <span>{form.nombre?.charAt(0)?.toUpperCase() || "U"}</span>
            )}
          </div>
          <div className="profile-avatar-info">
            <h3>{form.nombre || "Usuario"}</h3>
            <span className="profile-role-badge">{user.rol || "ADMINISTRADOR"}</span>
            <small>@{user.username || "usuario"}</small>
          </div>
          <button
            type="button"
            className="secondary-button profile-photo-btn"
            onClick={() => fileRef.current?.click()}
          >
            📷 Cambiar foto de perfil
          </button>
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={selectImage}
          />
          <span className="profile-photo-note">
            Formato recomendado: JPG, PNG o WEBP (máx 1.2 MB).
          </span>
        </aside>

        {/* Tarjeta de Formulario de Datos */}
        <section className="profile-fields-card">
          <div className="profile-card-header">
            <h2>Información General</h2>
            <p>Mantén tu información actualizada para el control administrativo de viajes.</p>
          </div>

          <div className="profile-fields-grid">
            <label className="profile-field">
              <span>Nombre completo</span>
              <input
                required
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del usuario"
              />
            </label>

            <label className="profile-field">
              <span>Correo electrónico</span>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => setForm({ ...form, correo: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </label>

            <label className="profile-field">
              <span>Teléfono de contacto</span>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="Ej. 938 123 4567"
              />
            </label>

            <label className="profile-field">
              <span>Contacto de emergencia (Siniestros)</span>
              <input
                type="text"
                value={form.contactoEmergencia}
                onChange={(e) => setForm({ ...form, contactoEmergencia: e.target.value })}
                placeholder="Nombre y teléfono para emergencias"
              />
            </label>
          </div>

          <div className="profile-form-footer">
            <button type="submit" className="primary-button profile-submit-btn">
              💾 Guardar cambios de perfil
            </button>
          </div>
        </section>
      </form>

      {cropSource && (
        <ImageCropModal
          source={cropSource}
          onCancel={() => setCropSource("")}
          onConfirm={(avatarUrl) => {
            setForm({ ...form, avatarUrl });
            setCropSource("");
          }}
        />
      )}
    </section>
  );
}
