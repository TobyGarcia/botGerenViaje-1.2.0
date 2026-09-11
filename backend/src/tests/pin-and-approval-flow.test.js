import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { databasePool } from "../database/pool.js";
import {
  findOrCreateTelegramUser,
  registerTelegramDriver
} from "../services/telegram-auth.service.js";
import {
  approveAdminDriver,
  createAdminDriver
} from "../services/admin-conductores.service.js";
import {
  setDriverPin,
  authenticateDriverWithPin
} from "../services/driver-auth.service.js";

describe("🧪 Simulación y Pruebas Unitarias del Flujo Unificado de PIN y Aprobación", () => {
  const createdConductorIds = [];
  const createdTelegramUserIds = [];

  after(async () => {
    const client = await databasePool.connect();
    try {
      await client.query("BEGIN");
      if (createdTelegramUserIds.length > 0) {
        await client.query(
          `DELETE FROM usuarios_telegram WHERE id_usuario_telegram = ANY($1::int[])`,
          [createdTelegramUserIds]
        );
      }
      if (createdConductorIds.length > 0) {
        await client.query(
          `DELETE FROM conductores WHERE id_conductores = ANY($1::int[])`,
          [createdConductorIds]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Error en limpieza de tests:", e);
    } finally {
      client.release();
    }
  });

  test("Caso 1: Registro inicial de conductor desde Telegram -> Genera PIN de 4 dígitos, lo almacena hasheado y queda pendiente", async () => {
    const testTgId = String(Date.now());
    const tgUser = await findOrCreateTelegramUser({
      telegramUser: {
        id: testTgId,
        username: `tg_test_${testTgId}`,
        first_name: "Conductor",
        last_name: "Nuevo"
      }
    });
    createdTelegramUserIds.push(tgUser.id_usuario_telegram);

    const testLicencia = `LIC-TG-${Date.now()}`;
    const res = await registerTelegramDriver({
      telegramUserId: testTgId,
      nombre: "Conductor Telegram Test",
      telefono: "5551234567",
      licenciaNumero: testLicencia,
      tipoLicencia: "B",
      empresa: "ASPROMEX",
      licenciaVencimiento: "2030-12-31"
    });

    // Validar retorno
    assert.ok(res.conductor, "Debe retornar objeto conductor");
    assert.ok(res.conductor.id_conductores > 0, "Debe tener un ID válido");
    assert.equal(res.conductor.aprobado_por_admin, false, "Debe registrarse con aprobado_por_admin = false");
    assert.ok(res.pinGenerado, "Debe retornar el pinGenerado");
    assert.match(res.pinGenerado, /^\d{4}$/, "El PIN debe tener exactamente 4 dígitos");

    createdConductorIds.push(res.conductor.id_conductores);

    // Verificar en BD que el hash coincide con el PIN
    const client = await databasePool.connect();
    try {
      const dbCheck = await client.query(
        `SELECT pin_hash, aprobado_por_admin FROM conductores WHERE id_conductores = $1`,
        [res.conductor.id_conductores]
      );
      assert.equal(dbCheck.rows.length, 1);
      assert.ok(dbCheck.rows[0].pin_hash, "pin_hash no debe ser null en la BD");
      
      const pinMatches = await bcrypt.compare(res.pinGenerado, dbCheck.rows[0].pin_hash);
      assert.equal(pinMatches, true, "El hash almacenado debe coincidir con el PIN generado");
    } finally {
      client.release();
    }

    // Intento de login ANTES de aprobación: debe ser rechazado por PENDING_APPROVAL
    const loginPendiente = await authenticateDriverWithPin({
      idConductor: res.conductor.id_conductores,
      pin: res.pinGenerado
    });
    assert.equal(loginPendiente.authenticated, false);
    assert.equal(loginPendiente.reason, "PENDING_APPROVAL", "No debe permitir login si no está aprobado");
  });

  test("Caso 2: Re-registro del mismo conductor desde Telegram -> Actualiza datos y genera un NUEVO PIN", async () => {
    const testTgId = String(Date.now() + 1);
    const tgUser = await findOrCreateTelegramUser({
      telegramUser: {
        id: testTgId,
        username: `tg_re_${testTgId}`,
        first_name: "Original",
        last_name: "Test"
      }
    });
    createdTelegramUserIds.push(tgUser.id_usuario_telegram);

    const testLicencia = `LIC-RE-${Date.now()}`;

    // Primer registro
    const primerRegistro = await registerTelegramDriver({
      telegramUserId: testTgId,
      nombre: "Conductor Original",
      telefono: "5551112233",
      licenciaNumero: testLicencia,
      tipoLicencia: "A",
      empresa: "ASPROMEX",
      licenciaVencimiento: "2029-01-01"
    });

    const conductorId = primerRegistro.conductor.id_conductores;
    createdConductorIds.push(conductorId);

    // Segundo registro con misma cuenta / licencia pero teléfono modificado
    const segundoRegistro = await registerTelegramDriver({
      telegramUserId: testTgId,
      nombre: "Conductor Nombre Actualizado",
      telefono: "5559998877",
      licenciaNumero: testLicencia,
      tipoLicencia: "B",
      empresa: "AQUARIO",
      licenciaVencimiento: "2031-05-20"
    });

    assert.equal(segundoRegistro.conductor.id_conductores, conductorId, "Mantiene el mismo ID");
    assert.equal(segundoRegistro.conductor.nombre, "Conductor Nombre Actualizado");
    assert.equal(segundoRegistro.conductor.empresa, "AQUARIO");
    assert.ok(segundoRegistro.pinGenerado, "Debe generar un nuevo PIN");
    assert.match(segundoRegistro.pinGenerado, /^\d{4}$/, "PIN debe ser de 4 dígitos");

    // Verificar en BD que el nuevo PIN es el vigente
    const client = await databasePool.connect();
    try {
      const dbCheck = await client.query(
        `SELECT pin_hash FROM conductores WHERE id_conductores = $1`,
        [conductorId]
      );
      const newPinMatches = await bcrypt.compare(segundoRegistro.pinGenerado, dbCheck.rows[0].pin_hash);
      assert.equal(newPinMatches, true, "El hash en BD debe coincidir con el segundo PIN generado");
    } finally {
      client.release();
    }
  });

  test("Caso 3: Aprobación de conductor que ya tiene PIN -> Supervisor aprueba sin alterar el PIN preexistente", async () => {
    // Usamos el conductor del Caso 1
    const conductorId = createdConductorIds[0];

    // Obtenemos el pin_hash y PIN original antes de aprobar
    const client = await databasePool.connect();
    let pinHashAntes;
    try {
      const r = await client.query(`SELECT pin_hash FROM conductores WHERE id_conductores = $1`, [conductorId]);
      pinHashAntes = r.rows[0].pin_hash;
    } finally {
      client.release();
    }

    // Supervisor aprueba al conductor
    const aprobacion = await approveAdminDriver({ idConductor: conductorId, aprobado: true });

    assert.equal(aprobacion.id_conductores, conductorId);
    assert.equal(aprobacion.aprobado_por_admin, true, "Debe quedar aprobado");
    assert.equal(aprobacion.tiene_pin, true, "Debe reportar tiene_pin = true");
    assert.equal(aprobacion.pinGenerado, null, "No debe generar PIN nuevo porque ya tenía uno");

    // Verificar que el hash en BD es exactamente el mismo
    const client2 = await databasePool.connect();
    try {
      const r2 = await client2.query(`SELECT pin_hash, aprobado_por_admin FROM conductores WHERE id_conductores = $1`, [conductorId]);
      assert.equal(r2.rows[0].pin_hash, pinHashAntes, "El hash del PIN original se conservó intacto");
      assert.equal(r2.rows[0].aprobado_por_admin, true);
    } finally {
      client2.release();
    }
  });

  test("Caso 4: Aprobación de conductor legado SIN PIN -> Auto-asigna PIN de 4 dígitos al aprobar", async () => {
    // Insertamos conductor sin pin (pin_hash = NULL)
    const client = await databasePool.connect();
    let conductorId;
    try {
      const ins = await client.query(
        `INSERT INTO conductores (nombre, telefono, licencia_numero, tipo_licencia, empresa, licencia_vencimiento, licencia_vigente, pin_hash, aprobado_por_admin)
         VALUES ('Conductor Legado Sin PIN', '5553334455', $1, 'B', 'ITZAMNA', '2030-01-01', TRUE, NULL, FALSE)
         RETURNING id_conductores`,
        [`LIC-LEGADO-${Date.now()}`]
      );
      conductorId = ins.rows[0].id_conductores;
      createdConductorIds.push(conductorId);
    } finally {
      client.release();
    }

    // Supervisor aprueba al conductor
    const aprobacion = await approveAdminDriver({ idConductor: conductorId, aprobado: true });

    assert.equal(aprobacion.aprobado_por_admin, true);
    assert.equal(aprobacion.tiene_pin, true);
    assert.ok(aprobacion.pinGenerado, "Debe retornar un PIN auto-generado");
    assert.match(aprobacion.pinGenerado, /^\d{4}$/, "PIN debe ser de 4 dígitos");

    // Verificar que ahora sí tiene pin_hash en BD
    const client2 = await databasePool.connect();
    try {
      const dbCheck = await client2.query(
        `SELECT pin_hash FROM conductores WHERE id_conductores = $1`,
        [conductorId]
      );
      assert.ok(dbCheck.rows[0].pin_hash, "pin_hash ya no debe ser NULL");
      const match = await bcrypt.compare(aprobacion.pinGenerado, dbCheck.rows[0].pin_hash);
      assert.equal(match, true, "El hash debe coincidir con el PIN auto-generado");
    } finally {
      client2.release();
    }

    // Probar login con el PIN generado automáticamente: debe autenticar exitosamente
    const loginConductor = await authenticateDriverWithPin({
      idConductor: conductorId,
      pin: aprobacion.pinGenerado
    });
    assert.equal(loginConductor.authenticated, true, "El conductor debe poder autenticarse con el PIN asignado");
    assert.ok(loginConductor.token, "Debe generar token de sesión");
  });

  test("Caso 5: Creación directa por Administrador (createAdminDriver) -> Auto-genera PIN y queda activo/aprobado", async () => {
    const nuevoConductor = await createAdminDriver({
      nombre: "Conductor Creado Por Admin",
      telefono: "5557778899",
      licenciaNumero: `LIC-ADM-${Date.now()}`,
      tipoLicencia: "B",
      empresa: "MCCLICK",
      licenciaVencimiento: "2032-12-31"
    });

    assert.ok(nuevoConductor.id_conductores > 0);
    assert.equal(nuevoConductor.aprobado_por_admin, true);
    assert.equal(nuevoConductor.activo, true);
    assert.equal(nuevoConductor.tiene_pin, true);
    assert.ok(nuevoConductor.pinGenerado);
    assert.match(nuevoConductor.pinGenerado, /^\d{4}$/);

    createdConductorIds.push(nuevoConductor.id_conductores);

    // Validar login exitoso inmediato con ese PIN
    const login = await authenticateDriverWithPin({
      idConductor: nuevoConductor.id_conductores,
      pin: nuevoConductor.pinGenerado
    });
    assert.equal(login.authenticated, true);
    assert.ok(login.token);
  });

  test("Caso 6: Supervisor regenera PIN (setDriverPin) -> PIN manual y revocación del anterior", async () => {
    const conductorId = createdConductorIds[0];
    const nuevoPin = "7412";

    const updated = await setDriverPin({
      idConductor: conductorId,
      pin: nuevoPin
    });

    assert.equal(updated.id_conductores, conductorId);

    // Login con PIN anterior incorrecto
    const loginFallo = await authenticateDriverWithPin({
      idConductor: conductorId,
      pin: "0000"
    });
    assert.equal(loginFallo.authenticated, false);
    assert.equal(loginFallo.reason, "INVALID_PIN");

    // Login con el nuevo PIN asignado
    const loginExito = await authenticateDriverWithPin({
      idConductor: conductorId,
      pin: nuevoPin
    });
    assert.equal(loginExito.authenticated, true);
    assert.ok(loginExito.token);
  });

  test("Caso 7: Validaciones de PIN inválido y casos de error", async () => {
    const conductorId = createdConductorIds[0];

    // Longitud incorrecta (3 dígitos)
    await assert.rejects(
      async () => {
        await setDriverPin({ idConductor: conductorId, pin: "123" });
      },
      /El PIN debe ser un código numérico de 4 dígitos/
    );

    // Longitud incorrecta (5 dígitos)
    await assert.rejects(
      async () => {
        await setDriverPin({ idConductor: conductorId, pin: "12345" });
      },
      /El PIN debe ser un código numérico de 4 dígitos/
    );

    // Caracteres no numéricos
    await assert.rejects(
      async () => {
        await setDriverPin({ idConductor: conductorId, pin: "12ab" });
      },
      /El PIN debe ser un código numérico de 4 dígitos/
    );

    // Conductor inexistente
    await assert.rejects(
      async () => {
        await setDriverPin({ idConductor: 99999999, pin: "1234" });
      },
      /Conductor no encontrado/
    );
  });
});
