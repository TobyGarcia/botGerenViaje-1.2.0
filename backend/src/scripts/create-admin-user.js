import readline from "node:readline/promises";
import process from "node:process";

import bcrypt from "bcryptjs";

import {
  databasePool
} from "../database/pool.js";

const VALID_ROLES = [
  "ADMINISTRADOR",
  "SUPERVISOR",
  "OPERADOR",
  "CONSULTA"
];

const PASSWORD_ROUNDS = 12;

function normalizeUsername(value) {
  return value
    .trim()
    .toLowerCase();
}

function normalizeEmail(value) {
  const email = value
    .trim()
    .toLowerCase();

  return email || null;
}

function validateEmail(email) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function validatePassword(password) {
  if (password.length < 10) {
    return {
      valid: false,
      message:
        "La contraseña debe tener al menos 10 caracteres."
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message:
        "La contraseña debe contener al menos una letra mayúscula."
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message:
        "La contraseña debe contener al menos una letra minúscula."
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message:
        "La contraseña debe contener al menos un número."
    };
  }

  return {
    valid: true,
    message: null
  };
}

async function userAlreadyExists({
  username,
  email
}) {
  const result =
    await databasePool.query(
      `
        SELECT
          id_usuarios_admin,
          username,
          correo
        FROM usuarios_admin
        WHERE LOWER(username) = LOWER($1)
           OR (
             $2::text IS NOT NULL
             AND LOWER(correo) = LOWER($2)
           )
        LIMIT 1
      `,
      [
        username,
        email
      ]
    );

  return result.rows[0] ?? null;
}

async function createAdminUser({
  name,
  username,
  email,
  password,
  role
}) {
  const existingUser =
    await userAlreadyExists({
      username,
      email
    });

  if (existingUser) {
    throw new Error(
      "Ya existe un usuario administrativo con ese username o correo."
    );
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      PASSWORD_ROUNDS
    );

  const result =
    await databasePool.query(
      `
        INSERT INTO usuarios_admin (
          nombre,
          username,
          correo,
          password_hash,
          rol,
          activo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          TRUE
        )
        RETURNING
          id_usuarios_admin,
          nombre,
          username,
          correo,
          rol,
          activo,
          creado_en
      `,
      [
        name,
        username,
        email,
        passwordHash,
        role
      ]
    );

  return result.rows[0];
}

async function main() {
  const readlineInterface =
    readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

  try {
    console.log("");
    console.log(
      "Creación de usuario administrativo"
    );
    console.log(
      "----------------------------------"
    );

    const name =
      (
        await readlineInterface.question(
          "Nombre completo: "
        )
      ).trim();

    const username =
      normalizeUsername(
        await readlineInterface.question(
          "Nombre de usuario: "
        )
      );

    const email =
      normalizeEmail(
        await readlineInterface.question(
          "Correo electrónico (opcional): "
        )
      );

    console.log("");
    console.log(
      `Roles disponibles: ${VALID_ROLES.join(", ")}`
    );

    const selectedRole =
      (
        await readlineInterface.question(
          "Rol [ADMINISTRADOR]: "
        )
      )
        .trim()
        .toUpperCase();

    const role =
      selectedRole || "ADMINISTRADOR";

    const password =
      await readlineInterface.question(
        "Contraseña: "
      );

    const passwordConfirmation =
      await readlineInterface.question(
        "Confirma la contraseña: "
      );

    if (!name) {
      throw new Error(
        "El nombre completo es obligatorio."
      );
    }

    if (name.length < 3) {
      throw new Error(
        "El nombre completo debe tener al menos 3 caracteres."
      );
    }

    if (!username) {
      throw new Error(
        "El nombre de usuario es obligatorio."
      );
    }

    if (
      !/^[a-z0-9._-]{4,100}$/.test(
        username
      )
    ) {
      throw new Error(
        "El username debe tener entre 4 y 100 caracteres y usar solamente letras, números, punto, guion o guion bajo."
      );
    }

    if (!validateEmail(email)) {
      throw new Error(
        "El correo electrónico no tiene un formato válido."
      );
    }

    if (
      !VALID_ROLES.includes(role)
    ) {
      throw new Error(
        `El rol debe ser uno de los siguientes: ${VALID_ROLES.join(", ")}.`
      );
    }

    const passwordValidation =
      validatePassword(password);

    if (!passwordValidation.valid) {
      throw new Error(
        passwordValidation.message
      );
    }

    if (
      password !==
      passwordConfirmation
    ) {
      throw new Error(
        "Las contraseñas no coinciden."
      );
    }

    const createdUser =
      await createAdminUser({
        name,
        username,
        email,
        password,
        role
      });

    console.log("");
    console.log(
      "Usuario administrativo creado correctamente."
    );

    console.log({
      idUsuarioAdmin:
        createdUser.id_usuarios_admin,

      nombre:
        createdUser.nombre,

      username:
        createdUser.username,

      correo:
        createdUser.correo,

      rol:
        createdUser.rol,

      activo:
        createdUser.activo
    });
  } catch (error) {
    console.error("");
    console.error(
      "No fue posible crear el usuario:"
    );

    console.error(
      error.message
    );

    process.exitCode = 1;
  } finally {
    readlineInterface.close();

    await databasePool.end();
  }
}

main();