-- ============================================================
--  TP3 – Sistema de Hábitos Personales
-- ============================================================
SET search_path TO public;
-- ============================================================
-- Eliminar tablas si existen (orden inverso por FK)
DROP TABLE IF EXISTS registros_habitos CASCADE;
DROP TABLE IF EXISTS habitos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================
--  TABLA 1: usuarios
-- ============================================================
CREATE TABLE public.usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  UNIQUE NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    rol             VARCHAR(20)   DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
    fecha_registro  TIMESTAMP     DEFAULT NOW()
);

-- ============================================================
--  TABLA 2: categorias
-- ============================================================
CREATE TABLE categorias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100)  UNIQUE NOT NULL,
    descripcion TEXT,
    icono       VARCHAR(10)   DEFAULT '📌'
);

-- ============================================================
--  TABLA 3: habitos
-- ============================================================
CREATE TABLE habitos (
    id               SERIAL PRIMARY KEY,
    id_usuario       INT           NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    id_categoria     INT           NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre           VARCHAR(150)  NOT NULL,
    descripcion      TEXT,
    frecuencia       VARCHAR(20)   DEFAULT 'diario' CHECK (frecuencia IN ('diario', 'semanal', 'mensual')),
    meta_dias        INT           DEFAULT 30,
    dias_completados INT           DEFAULT 0,
    activo           BOOLEAN       DEFAULT TRUE,
    fecha_inicio     DATE          DEFAULT CURRENT_DATE,
    fecha_creacion   TIMESTAMP     DEFAULT NOW()
);

-- ============================================================
--  TABLA 4: registros_habitos  (log de cada cumplimiento)
-- ============================================================
CREATE TABLE registros_habitos (
    id          SERIAL PRIMARY KEY,
    id_habito   INT     NOT NULL REFERENCES habitos(id) ON DELETE CASCADE,
    fecha       DATE    NOT NULL DEFAULT CURRENT_DATE,
    completado  BOOLEAN DEFAULT TRUE,
    nota        TEXT,
    UNIQUE (id_habito, fecha)
);

-- ============================================================
--  INDICES
-- ============================================================
CREATE INDEX idx_habitos_usuario  ON habitos(id_usuario);
CREATE INDEX idx_registros_habito ON registros_habitos(id_habito);
CREATE INDEX idx_registros_fecha  ON registros_habitos(fecha);

-- ============================================================
--  DATOS DE EJEMPLO
-- ============================================================
INSERT INTO categorias (nombre, descripcion, icono) VALUES
  ('Salud',         'Habitos relacionados con la salud fisica',         '💪'),
  ('Mente',         'Habitos de bienestar mental y meditacion',         '🧠'),
  ('Aprendizaje',   'Habitos de estudio y desarrollo de habilidades',   '📚'),
  ('Finanzas',      'Habitos de ahorro y control economico',            '💰'),
  ('Productividad', 'Habitos de organizacion y gestion del tiempo',     '⏰'),
  ('Social',        'Habitos de relaciones personales',                 '🤝');

-- Usuario admin de ejemplo  (password: admin123)
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
  ('Administrador', 'admin@habitos.com',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lN9i',
   'admin');

-- ============================================================
--  STORED PROCEDURE: registrar_cumplimiento
--  Verifica que el habito exista y este activo, luego inserta
--  el registro del dia. El trigger se encarga de sumar el contador.
-- ============================================================
CREATE OR REPLACE PROCEDURE registrar_cumplimiento(
    p_id_habito INT,
    p_nota      TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Verificar que el habito existe y esta activo
    IF NOT EXISTS (
        SELECT 1 FROM habitos WHERE id = p_id_habito AND activo = TRUE
    ) THEN
        RAISE EXCEPTION 'El habito con id % no existe o esta inactivo.', p_id_habito;
    END IF;

    -- Insertar registro (falla con UNIQUE si ya se registro hoy)
    INSERT INTO registros_habitos (id_habito, fecha, completado, nota)
    VALUES (p_id_habito, CURRENT_DATE, TRUE, p_nota);

    RAISE NOTICE 'Cumplimiento registrado para habito id=%', p_id_habito;
END;
$$;

-- ============================================================
--  TRIGGER: trg_actualizar_dias_completados
--  Se dispara automaticamente despues de INSERT/UPDATE/DELETE
--  en registros_habitos y mantiene actualizado el campo
--  dias_completados en la tabla habitos.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_actualizar_dias_completados()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.completado = TRUE) THEN
        UPDATE habitos
           SET dias_completados = dias_completados + 1
         WHERE id = NEW.id_habito;

    ELSIF (TG_OP = 'DELETE' AND OLD.completado = TRUE) THEN
        UPDATE habitos
           SET dias_completados = GREATEST(dias_completados - 1, 0)
         WHERE id = OLD.id_habito;

    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.completado = FALSE AND NEW.completado = TRUE THEN
            UPDATE habitos SET dias_completados = dias_completados + 1
             WHERE id = NEW.id_habito;
        ELSIF OLD.completado = TRUE AND NEW.completado = FALSE THEN
            UPDATE habitos SET dias_completados = GREATEST(dias_completados - 1, 0)
             WHERE id = NEW.id_habito;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_actualizar_dias_completados
AFTER INSERT OR UPDATE OR DELETE ON registros_habitos
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_dias_completados();

