import { assignAdminUserPin, createAdminUser, deleteAdminUser, listAdminUsers, registerPublicUser, updateAdminUser, updateOwnProfile, validAdminRole } from "../services/admin-usuarios.service.js";

function positiveId(value) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }
function normalize(body) {
  return { nombre: String(body?.nombre || "").trim(), username: String(body?.username || "").trim(),
    correo: String(body?.correo || "").trim(), password: String(body?.password || ""),
    rol: String(body?.rol || "").toUpperCase(), activo: body?.activo !== false,
    idConductor: body?.idConductor ? positiveId(body.idConductor) : null };
}
function validate(data, includePassword = false) {
  if (data.nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
  if (!validAdminRole(data.rol)) return "El rol seleccionado no es válido.";
  if (includePassword && data.password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}
export async function listAdminUsersController(req,res) { try { return res.json({ success:true, data:await listAdminUsers() }); } catch { return res.status(500).json({success:false,message:"No fue posible consultar los usuarios."}); } }
export async function createAdminUserController(req,res) { try { const data=normalize(req.body); const error=validate(data,true); if(error) return res.status(400).json({success:false,message:error}); const user=await createAdminUser(data); return res.status(201).json({success:true,data:user,message:"Usuario administrativo creado."}); } catch(error) { return res.status(error.code === "23505" ? 409 : 500).json({success:false,message:error.code === "23505" ? "El usuario o correo ya existe." : "No fue posible crear el usuario."}); } }
export async function updateAdminUserController(req,res) { try { const id=positiveId(req.params.idUsuario); const data=normalize(req.body); const error=!id ? "El usuario no es válido." : validate(data); if(error) return res.status(400).json({success:false,message:error}); if(id === req.adminUser.id_usuarios_admin && !data.activo) return res.status(400).json({success:false,message:"No puedes desactivar tu propia sesión."}); const user=await updateAdminUser(id,data); return user ? res.json({success:true,data:user,message:"Usuario actualizado."}) : res.status(404).json({success:false,message:"Usuario no encontrado."}); } catch { return res.status(500).json({success:false,message:"No fue posible actualizar el usuario."}); } }
export async function deleteAdminUserController(req,res) { try { const id=positiveId(req.params.idUsuario); if(!id) return res.status(400).json({success:false,message:"El usuario no es válido."}); if(id === req.adminUser.id_usuarios_admin) return res.status(400).json({success:false,message:"No puedes eliminar tu propia cuenta."}); const user=await deleteAdminUser(id); return user ? res.json({success:true,message:"Usuario eliminado; el historial se conserva."}) : res.status(404).json({success:false,message:"Usuario no encontrado."}); } catch { return res.status(500).json({success:false,message:"No fue posible eliminar el usuario."}); } }
export async function updateOwnProfileController(req,res) { const data={...normalize(req.body), rol:req.adminUser.rol}; const error=validate(data); if(error) return res.status(400).json({success:false,message:error}); const user=await updateOwnProfile(req.adminUser.id_usuarios_admin, {...data, telefono:String(req.body?.telefono||"").trim(), contactoEmergencia:String(req.body?.contactoEmergencia||"").trim(), avatarUrl:String(req.body?.avatarUrl||"").trim()}); return res.json({success:true,data:user,message:"Perfil actualizado."}); }

export async function assignAdminUserPinController(req, res) {
  try {
    const id = positiveId(req.params.idUsuario);
    const pin = String(req.body?.pin || "").trim();

    if (!id) {
      return res.status(400).json({ success: false, message: "El usuario no es válido." });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "El PIN debe ser exactamente de 4 dígitos numéricos." });
    }

    const updated = await assignAdminUserPin(id, pin);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }

    return res.json({
      success: true,
      data: updated,
      message: `PIN asignado correctamente para ${updated.nombre}.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "No fue posible asignar el PIN." });
  }
}

export async function registerPublicUserController(req, res) {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const correo = String(req.body?.correo || "").trim().toLowerCase();
    const telefono = String(req.body?.telefono || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const rol = String(req.body?.rol || "SUPERVISOR").toUpperCase();

    if (!nombre) {
      return res.status(400).json({ success: false, message: "El nombre completo es requerido." });
    }

    if (!correo || !correo.includes("@")) {
      return res.status(400).json({ success: false, message: "Un correo corporativo válido es requerido." });
    }

    const user = await registerPublicUser({ nombre, username, correo, telefono, rol });
    return res.status(201).json({
      success: true,
      data: user,
      message: "Registro creado exitosamente. Pide a tu administrador que te active y asigne tu PIN desde el Panel Administrativo."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "No fue posible registrar la cuenta."
    });
  }
}
