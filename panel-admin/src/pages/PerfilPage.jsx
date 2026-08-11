import { useRef, useState } from "react";
import ImageCropModal from "../components/ImageCropModal.jsx";
import { updateMyProfile } from "../services/api.js";

export default function PerfilPage({ user, onUpdated }) {
  const fileRef=useRef(null);
  const [form,setForm]=useState({nombre:user.nombre,correo:user.correo||"",telefono:user.telefono||"",contactoEmergencia:user.contactoEmergencia||"",avatarUrl:user.avatarUrl||""});
  const [cropSource,setCropSource]=useState(""); const [message,setMessage]=useState("");
  function selectImage(event) { const file=event.target.files?.[0]; if(!file)return; if(file.size>1200000){setMessage("La foto debe pesar menos de 1.2 MB.");return;} const reader=new FileReader(); reader.onload=()=>setCropSource(String(reader.result)); reader.readAsDataURL(file); event.target.value=""; }
  async function save(event) { event.preventDefault(); try { const result=await updateMyProfile(form); onUpdated(result.data); setMessage(result.message); } catch(error){setMessage(error.message);} }
  return <section className="module-page"><header className="module-header"><div><span className="module-label">Mi cuenta</span><h1>Personalización de perfil</h1><p>Agrega datos importantes y un contacto para casos de siniestro.</p></div></header>{message&&<p className="module-message module-message-success">{message}</p>}
    <form className="profile-form" onSubmit={save}><section className="profile-photo-panel"><div className="profile-photo-large">{form.avatarUrl?<img src={form.avatarUrl} alt="Foto de perfil"/>:<span>{form.nombre?.charAt(0)||"U"}</span>}</div><button type="button" className="secondary-button" onClick={()=>fileRef.current?.click()}>Cambiar foto de perfil</button><input ref={fileRef} className="visually-hidden" type="file" accept="image/*" onChange={selectImage}/></section><section className="profile-fields"><label>Nombre<input required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label><label>Correo<input type="email" value={form.correo} onChange={e=>setForm({...form,correo:e.target.value})}/></label><label>Teléfono<input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/></label><label>Contacto de emergencia<input value={form.contactoEmergencia} onChange={e=>setForm({...form,contactoEmergencia:e.target.value})}/></label><div className="form-actions"><button className="primary-button">Guardar perfil</button></div></section></form>
    {cropSource&&<ImageCropModal source={cropSource} onCancel={()=>setCropSource("")} onConfirm={avatarUrl=>{setForm({...form,avatarUrl});setCropSource("");}}/>}</section>;
}
