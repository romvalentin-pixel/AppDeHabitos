# HábitosApp – TP3 Programación III

Aplicación web Full-Stack para el seguimiento de hábitos personales, construida con Node.js, Express y PostgreSQL.

---

## Descripción

HábitosApp permite a los usuarios registrarse, crear hábitos personales, marcarlos como completados cada día y ver su progreso histórico. Las rutas están protegidas con autenticación JWT.

---

## Estructura del proyecto

```
tp3-app/
├── server.js               # Punto de entrada del servidor
├── .env                    # Variables de entorno (NO subir a Git)
├── .env.example            # Ejemplo de variables de entorno
├── .gitignore
├── package.json
├── database.sql            # Script completo de la base de datos
├── db/
│   └── index.js            # Conexión al pool de PostgreSQL
├── controllers/
│   └── controllers.js      # Toda la lógica de los endpoints
├── routes/
│   ├── auth.js             # Rutas: /api/auth/register y /api/auth/login
│   └── habitos.js          # Rutas: /api/habitos (CRUD + cumplimiento)
├── middleware/
│   └── auth.js             # Middleware de verificación JWT
└── public/
    ├── index.html          # Frontend SPA
    ├── style.css           # Estilos
    └── app.js              # Lógica del frontend (fetch + localStorage)
```

---

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/romvalentin-pixel/AppDeHabitos.git
cd AppDeHabitos
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiar el archivo y completar los datos:

```bash
cp .env
```

Editar `.env`:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=NombreDeBaseDeDatos
DB_USER=NombreDeUsuarioDeDB
DB_PASSWORD=*********
JWT_SECRET=clave_larga_y_secreta
JWT_EXPIRES_IN=24h
```

### 4. Crear la base de datos en PostgreSQL

```bash
psql -U postgres -c "CREATE DATABASE habitosperosnales;"
psql -U postgres -d habitosperosnales -f database.sql
```

### 5. Iniciar el servidor

```bash
npm start
```

Abrir el navegador en: [http://localhost:3000](http://localhost:3000)

---


## Diseño de la base de datos

### Tablas

**usuarios** – Almacena los datos de acceso de cada usuario (nombre, email, password hasheado, rol).

**categorias** – Categorías predefinidas para clasificar hábitos (Salud, Mente, Aprendizaje, etc.).

**habitos** – Hábito creado por un usuario, vinculado a una categoría. Tiene nombre, frecuencia, meta en días y un contador `dias_completados`.

**registros_habitos** – Registro de cada vez que un hábito fue completado. Tiene una restricción UNIQUE (id_habito, fecha) para evitar duplicados el mismo día.

---

## Procedimiento Almacenado

**`registrar_cumplimiento(p_id_habito, p_nota)`**

Este procedimiento almacenado encapsula la lógica de marcar un hábito como completado para el día actual. Primero verifica que el hábito exista y esté activo; si no, lanza una excepción. Luego inserta el registro en `registros_habitos`. El trigger `trg_actualizar_dias_completados` se encarga automáticamente de incrementar el contador.

Se llama desde la API así:
```sql
CALL registrar_cumplimiento($1, $2);
```

**Ventaja**: centraliza la validación en la base de datos. Si la lógica cambia, solo se modifica el procedimiento y no el código de Node.js.

---

## Trigger

**`trg_actualizar_dias_completados`**

Se dispara automáticamente **AFTER INSERT, UPDATE o DELETE** en la tabla `registros_habitos`. Ejecuta la función `fn_actualizar_dias_completados()` que:

- Si se inserta un registro con `completado = TRUE` → suma 1 a `habitos.dias_completados`.
- Si se elimina un registro con `completado = TRUE` → resta 1 (mínimo 0).
- Si se actualiza `completado` entre TRUE y FALSE → ajusta el contador en consecuencia.

De esta forma el campo `dias_completados` siempre está sincronizado sin necesidad de calcularlo desde el servidor.

---

## Transacción con ROLLBACK

En el endpoint `POST /api/habitos` (crear hábito) se utiliza una transacción explícita:

```js
const client = await pool.connect();
await client.query('BEGIN');

// 1. Verifica que la categoría exista
// 2. Inserta el hábito

await client.query('COMMIT');
// Si cualquier operación falla:
await client.query('ROLLBACK');
```

**Por qué es importante**: si la verificación de la categoría pasa pero la inserción falla por algún error inesperado, el ROLLBACK garantiza que no quede ningún dato parcialmente guardado en la base de datos.

---

## Preguntas Conceptuales

### 1. ¿Qué es un servidor web y cómo funciona el ciclo request-response?

Un servidor web es un programa que escucha peticiones de clientes (navegadores, apps) a través de la red y les devuelve una respuesta. El ciclo empieza cuando el cliente envía un **request** con un método HTTP (GET, POST, etc.) y una URL. El servidor lo procesa —puede consultar una base de datos, ejecutar lógica— y devuelve un **response** con un código de estado (200, 404, etc.) y un cuerpo de datos (HTML, JSON, etc.). Todo esto viaja sobre el protocolo HTTP/HTTPS.

### 2. ¿Qué es Express y por qué lo usamos en lugar de solo Node.js?

Express es un framework minimalista que corre sobre Node.js. Node.js puro puede crear un servidor HTTP, pero hacerlo implica escribir mucho código repetitivo para parsear rutas, métodos, cuerpos de petición y manejar errores. Express simplifica todo eso con un sistema de rutas, middlewares y métodos como `router.get()` o `router.post()`, lo que hace el código más limpio, organizado y mantenible.

### 3. ¿Qué es un JWT y cómo se diferencia de guardar la sesión en el servidor?

Un JWT (JSON Web Token) es un token firmado digitalmente que contiene información del usuario (id, rol, etc.). Cuando el usuario inicia sesión, el servidor genera el token y se lo envía al cliente, que lo guarda (en localStorage, por ejemplo) y lo envía en cada request. El servidor solo verifica la firma para validarlo. A diferencia de las sesiones tradicionales, **el servidor no guarda nada en memoria ni en base de datos**: el token es autocontenido, lo que facilita escalar la aplicación.

### 4. ¿Qué ventaja tiene usar un procedimiento almacenado en lugar de escribir ese SQL desde Node.js?

El procedimiento almacenado encapsula lógica compleja directamente en la base de datos. Ventajas: (1) se puede reutilizar desde cualquier parte de la app o desde otras apps sin duplicar código; (2) reduce el tráfico entre servidor y BD al ejecutar múltiples sentencias en un solo llamado; (3) si la lógica cambia, solo se modifica el procedimiento y no hay que tocar el código de Node.js ni hacer un nuevo deploy.

### 5. ¿Por qué es importante usar transacciones? Ejemplo de ROLLBACK.

Una transacción garantiza que un conjunto de operaciones se ejecuten **todas o ninguna**. Ejemplo: al crear un hábito, primero verificamos que la categoría exista y luego insertamos el hábito. Si entre esas dos operaciones ocurre un error (caída de conexión, constraint violation), el ROLLBACK revierte todo, evitando que quede un estado inconsistente en la base de datos. Sin transacciones, podríamos terminar con un hábito sin categoría válida o datos a medias.

### 6. ¿Qué es un trigger? Describí el trigger que implementaste.

Un trigger es una acción automática que la base de datos ejecuta cuando ocurre un evento (INSERT, UPDATE, DELETE) sobre una tabla, sin que el programador lo llame explícitamente. En esta app implementé `trg_actualizar_dias_completados`: se dispara **AFTER INSERT OR UPDATE OR DELETE** en la tabla `registros_habitos`. Cuando se inserta un registro de cumplimiento, incrementa automáticamente el campo `dias_completados` en la tabla `habitos`. Si se elimina un registro, lo decrementa. Así el contador siempre está actualizado sin lógica extra en Node.js.

---

## Criterios de evaluación cubiertos

| Aspecto | Puntos | Estado |
|---|---|---|
| Base de datos (4 tablas + relaciones + script .sql) | 8 | ✅ |
| Procedimiento almacenado (`registrar_cumplimiento`) | 4 | ✅ |
| Trigger (`trg_actualizar_dias_completados`) | 4 | ✅ |
| Transacción con ROLLBACK (en `createHabito`) | 4 | ✅ |
| API REST con Node + Express | 5 | ✅ |
| Autenticación JWT (register, login, middleware) | 3 | ✅ |
| Frontend funcional (HTML/CSS/JS + fetch + localStorage) | 2 | ✅ |
| **Total** | **30** | ✅ |

---

## Autor: Romano Jesus Valentin

Trabajo Práctico N°3 – Programación III  
Tecnicatura Superior en Programación
