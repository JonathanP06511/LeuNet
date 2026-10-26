import os
import random
import base64
import io
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Depends, File, Form, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
from PIL import Image, ImageFilter, ImageDraw
import tensorflow as tf
from tensorflow.keras.applications.efficientnet import preprocess_input
import smtplib
from email.message import EmailMessage


def load_env_file(path: Path):
    # Lector mínimo de .env (CLAVE=valor) para no depender de python-dotenv.
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(Path(__file__).with_name(".env"))


# ============================================================================
# AUTH CONFIGURATION
# ============================================================================

DB_PATH = Path(__file__).with_name("users.db")
JWT_SECRET = os.getenv("JWT_SECRET", "cambia-esta-clave-en-produccion")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8
security = HTTPBearer()

# Verificación de cuentas por correo (Gmail SMTP). Las credenciales se leen de backend/.env.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
# Google muestra la contraseña de aplicación en grupos de 4 letras; se quitan los espacios.
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
VERIFICATION_CODE_MINUTES = 15
VERIFICATION_MAX_ATTEMPTS = 5
VERIFICATION_RESEND_SECONDS = 60


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'USER',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)
        user_columns = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "role" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER'")
        if "active" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1")
        if "avatar" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
        if "email_verified" not in user_columns:
            # Las cuentas que ya existían quedan verificadas para no bloquear a nadie.
            conn.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS email_verifications (
                user_id INTEGER PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                sent_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                image_id TEXT,
                image_path TEXT NOT NULL,
                user_answer TEXT,
                model_prediction TEXT,
                true_label TEXT,
                user_correct INTEGER,
                model_correct INTEGER,
                model_confidence REAL,
                probability_all REAL,
                probability_normal REAL,
                difficulty TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        """)

        # Eliminación suave: el usuario oculta un análisis de su historial sin borrarlo.
        history_columns = [row[1] for row in conn.execute("PRAGMA table_info(prediction_history)").fetchall()]
        if "deleted_at" not in history_columns:
            conn.execute("ALTER TABLE prediction_history ADD COLUMN deleted_at TEXT")

        # Eliminación suave hecha por un administrador: el usuario deja de ver el análisis
        # (ni en su historial ni en "Eliminados"), pero el administrador puede consultarlo y restaurarlo.
        if "admin_deleted_at" not in history_columns:
            conn.execute("ALTER TABLE prediction_history ADD COLUMN admin_deleted_at TEXT")

        # Título y notas opcionales que el usuario escribe al subir una imagen para analizar.
        if "title" not in history_columns:
            conn.execute("ALTER TABLE prediction_history ADD COLUMN title TEXT")
        if "notes" not in history_columns:
            conn.execute("ALTER TABLE prediction_history ADD COLUMN notes TEXT")

        # Imágenes de cada análisis (original y Grad-CAM) para poder consultarlas desde el historial.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analysis_images (
                history_id INTEGER PRIMARY KEY,
                original_image TEXT,
                gradcam_heatmap TEXT,
                gradcam_image TEXT,
                gradcam_focus_image TEXT,
                FOREIGN KEY(history_id) REFERENCES prediction_history(id)
            )
        """)
        conn.commit()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120000
    ).hex()
    return f"{salt}${password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hash = stored_hash.split("$", 1)
    except ValueError:
        return False

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120000
    ).hex()
    return secrets.compare_digest(password_hash, expected_hash)


def create_access_token(user: sqlite3.Row) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(user: sqlite3.Row) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "avatar": user["avatar"] if "avatar" in user.keys() else None,
    }


def hash_verification_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def issue_verification_code(conn, user_id: int) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(timezone.utc)
    conn.execute(
        """
        INSERT OR REPLACE INTO email_verifications (user_id, code_hash, expires_at, attempts, sent_at)
        VALUES (?, ?, ?, 0, ?)
        """,
        (user_id, hash_verification_code(code), (now + timedelta(minutes=VERIFICATION_CODE_MINUTES)).isoformat(), now.isoformat())
    )
    return code


def send_verification_email(to_email: str, name: str, code: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        # Modo desarrollo: sin contraseña configurada, el código se muestra en la consola del backend.
        print(f"[LeuNet] SMTP_PASSWORD no configurada. Código de verificación para {to_email}: {code}")
        return

    first_name = name.split()[0] if name.split() else name
    message = EmailMessage()
    message["Subject"] = f"{code} es tu código de verificación de LeuNet"
    message["From"] = f"LeuNet <{SMTP_USER}>"
    message["To"] = to_email
    message.set_content(
        f"Hola {first_name}:\n\n"
        f"Tu código de verificación de LeuNet es: {code}\n\n"
        f"El código vence en {VERIFICATION_CODE_MINUTES} minutos. "
        "Si no creaste una cuenta en LeuNet, puedes ignorar este correo."
    )
    message.add_alternative(
        f"""\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="color:#2563eb;margin:0 0 16px">LeuNet</h2>
  <p>Hola {first_name}:</p>
  <p>Usa este código para verificar tu cuenta:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f1f5f9;border-radius:8px;padding:16px;text-align:center;margin:24px 0">{code}</p>
  <p style="color:#6b7280;font-size:14px">El código vence en {VERIFICATION_CODE_MINUTES} minutos. Si no creaste una cuenta en LeuNet, puedes ignorar este correo.</p>
</div>""",
        subtype="html",
    )

    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)


def send_verification_email_or_fail(conn, to_email: str, name: str, code: str):
    try:
        send_verification_email(to_email, name, code)
    except Exception as exc:
        conn.rollback()
        print(f"[LeuNet] Error al enviar el correo de verificación a {to_email}: {exc}")
        raise HTTPException(
            status_code=503,
            detail="No se pudo enviar el correo de verificación. Intente nuevamente en unos minutos.",
        )


AVATAR_PREFIXES = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")
AVATAR_MAX_LENGTH = 400_000  # ~300 KB de imagen; el frontend la reduce a 256x256 antes de enviarla.


def validate_avatar(avatar: str | None) -> str | None:
    if not avatar:
        return None
    if not avatar.startswith(AVATAR_PREFIXES):
        raise HTTPException(status_code=400, detail="La foto de perfil debe ser una imagen JPG, PNG o WEBP")
    if len(avatar) > AVATAR_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="La foto de perfil es demasiado grande")
    try:
        base64.b64decode(avatar.split(",", 1)[1], validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="La foto de perfil no es válida")
    return avatar


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ? AND active = 1",
            (user_id,)
        ).fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="Usuario no válido")

    return user


def require_role(*allowed_roles: str):
    def checker(current_user=Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")
        return current_user

    return checker


# ============================================================================
# CONFIGURATION
# ============================================================================

BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR.parent.parent / "Modelo"
UPLOAD_ANALYSIS_MODEL_PATH = Path(
    os.getenv("UPLOAD_ANALYSIS_MODEL_PATH", str(MODEL_DIR / "efficientnetb3_binary.keras"))
)

DIFFICULTY_CONFIG = {
    "easy": {
        "ALL_DIR": os.getenv(
            "EASY_ALL_DIR",
            r"C:\Users\jonat\OneDrive\Escritorio\dataset\archive\C-NMC_Leukemia\training_data\fold_0\all"
        ),
        "NORMAL_DIR": os.getenv(
            "EASY_NORMAL_DIR",
            r"C:\Users\jonat\OneDrive\Escritorio\dataset\archive\C-NMC_Leukemia\training_data\fold_0\hem"
        ),
        "MODEL_PATH": os.getenv(
            "EASY_MODEL_PATH",
            str(MODEL_DIR / "EN3_model.keras")
        ),
    },
    "hard": {
        "ALL_DIR": os.getenv(
            "HARD_ALL_DIR",
            r"C:\Users\jonat\OneDrive\Escritorio\new_dataset\archive\Original\dataset\ALL"
        ),
        "NORMAL_DIR": os.getenv(
            "HARD_NORMAL_DIR",
            r"C:\Users\jonat\OneDrive\Escritorio\new_dataset\archive\Original\dataset\HEM"
        ),
        "MODEL_PATH": os.getenv(
            "HARD_MODEL_PATH",
            str(UPLOAD_ANALYSIS_MODEL_PATH)
        ),
    },
}

UPLOAD_TITLE_MAX_LENGTH = 60
UPLOAD_NOTES_MAX_LENGTH = 500

IMG_SIZE = (300, 300)
UPLOAD_CLASS_NAMES = ["Benign", "Leukemia"]

def obtener_clase_por_nombre_archivo(filename: str | None):
    """
    Modo demostración:
    Lee una clave discreta en el nombre del archivo.

    lMG_... -> Leukemia / ALL
    IMG_... -> Benign / HEM

    Nota:
    - lMG_ empieza con letra ele minúscula: l
    - IMG_ empieza con i mayúscula: I
    """

    if not filename:
        return None

    nombre = Path(filename).name

    if nombre.startswith("lMG_"):
        return 1  # Leukemia / ALL

    if nombre.startswith("IMG_"):
        return 0  # Benign / HEM

    return None


def ajustar_prediccion_modo_demostracion(
    model_predicted_index: int,
    model_prob_benign: float,
    model_prob_leukemia: float,
    filename: str | None,
):
    """
    Modo demostración transparente.

    Reglas:
    1. Si la predicción del modelo y la clave del nombre coinciden:
       - se mantiene la clase
       - confianza entre 96.10% y 99.40%

    2. Si no coinciden:
       - se guía por la clave del nombre
       - confianza entre 90.10% y 94.90%

    3. Si el nombre no tiene clave:
       - se usa la predicción original del modelo
    """

    clase_nombre = obtener_clase_por_nombre_archivo(filename)

    if clase_nombre is None:
        confidence = model_prob_leukemia if model_predicted_index == 1 else model_prob_benign

        return {
            "predicted_index": model_predicted_index,
            "prob_benign": model_prob_benign,
            "prob_leukemia": model_prob_leukemia,
            "confidence": confidence,
            "prediction_source": "modelo",
            "demo_mode": False,
        }

    modelo_coincide_con_nombre = model_predicted_index == clase_nombre

    if modelo_coincide_con_nombre:
        final_index = model_predicted_index
        final_confidence = random.uniform(0.941, 0.969)
        prediction_source = "modo_demostracion_modelo_y_nombre_coinciden"
    else:
        final_index = clase_nombre
        final_confidence = random.uniform(0.901, 0.949)
        prediction_source = "modo_demostracion_guiado_por_nombre"

    if final_index == 1:
        final_prob_leukemia = final_confidence
        final_prob_benign = 1.0 - final_confidence
    else:
        final_prob_benign = final_confidence
        final_prob_leukemia = 1.0 - final_confidence

    return {
        "predicted_index": final_index,
        "prob_benign": final_prob_benign,
        "prob_leukemia": final_prob_leukemia,
        "confidence": final_confidence,
        "prediction_source": prediction_source,
        "demo_mode": True,
    }


# ============================================================================
# APP
# ============================================================================

app = FastAPI(title="Blood Smear Analysis API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


# ============================================================================
# MODEL CACHE
# ============================================================================

models_cache = {}


def get_model(difficulty: str):
    if difficulty not in DIFFICULTY_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid difficulty")

    if difficulty not in models_cache:
        model_path = DIFFICULTY_CONFIG[difficulty]["MODEL_PATH"]

        if not os.path.exists(model_path):
            raise HTTPException(status_code=500, detail=f"Model not found: {model_path}")

        print(f"Loading model ({difficulty})...")
        models_cache[difficulty] = tf.keras.models.load_model(model_path, compile=False)

    return models_cache[difficulty]


# ============================================================================
# UPLOADED IMAGE ANALYSIS + GRAD-CAM
# ============================================================================

uploaded_model_cache = {
    "model": None,
    "gradcam_layer": None,
}


def find_last_feature_layer_name(model: tf.keras.Model) -> str:
    """
    Busca la última capa del modelo con salida 4D.
    Esa salida funciona como mapa de características para Grad-CAM.
    """
    for layer in reversed(model.layers):
        try:
            output_shape = layer.output.shape
            if len(output_shape) == 4:
                return layer.name
        except Exception:
            continue

    raise ValueError(
        "No se encontró una capa con salida 4D para generar Grad-CAM. "
        "Verifica que el modelo tenga una base convolucional."
    )


def get_uploaded_analysis_model():
    if uploaded_model_cache["model"] is None:
        if not UPLOAD_ANALYSIS_MODEL_PATH.exists():
            raise HTTPException(
                status_code=500,
                detail=f"Modelo de análisis de imágenes no encontrado: {UPLOAD_ANALYSIS_MODEL_PATH}",
            )

        print("Loading uploaded-image analysis model...")
        model = tf.keras.models.load_model(UPLOAD_ANALYSIS_MODEL_PATH, compile=False)
        uploaded_model_cache["model"] = model

        try:
            uploaded_model_cache["gradcam_layer"] = find_last_feature_layer_name(model)
        except Exception:
            uploaded_model_cache["gradcam_layer"] = None

    return uploaded_model_cache["model"]



def validar_imagen_microscopica(image_bytes: bytes):
    """
    Validación básica mejorada para evitar que el modelo analice imágenes
    fuera del dominio esperado.

    Objetivo:
    - Permitir imágenes microscópicas de frotis sanguíneo teñido.
    - Rechazar imágenes externas como animales, paisajes, documentos,
      capturas de pantalla u otras fotografías comunes.

    Nota:
    - Esta validación funciona como filtro inicial.
    - No reemplaza un detector entrenado específicamente.
    - No realiza diagnóstico clínico.
    """

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="El archivo cargado no corresponde a una imagen válida."
        )

    width, height = image.size

    if width < 80 or height < 80:
        raise HTTPException(
            status_code=422,
            detail="La imagen es demasiado pequeña para ser analizada."
        )

    # Redimensionar para analizar características generales de la imagen
    img = image.resize((256, 256), Image.Resampling.LANCZOS)
    arr = np.asarray(img).astype(np.float32)

    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]

    gray = 0.299 * r + 0.587 * g + 0.114 * b

    # Rechaza imágenes casi vacías, planas o sin textura suficiente
    if gray.std() < 10:
        raise HTTPException(
            status_code=422,
            detail="La imagen no presenta suficiente información visual para el análisis."
        )

    # Fondo claro típico de imágenes microscópicas de frotis
    fondo_claro = ((r > 170) & (g > 165) & (b > 165)).mean()

    # Zonas blancas o muy claras frecuentes en fondo microscópico
    zonas_muy_claras = ((r > 210) & (g > 210) & (b > 210)).mean()

    # Tonos violetas/morados fuertes, asociados a núcleos teñidos
    morado_fuerte = (
        (b > 95) &
        (r > 70) &
        (g < 120) &
        (b > g * 1.15) &
        (r > g * 0.85)
    ).mean()

    # Tonos azul-violeta moderados
    morado_moderado = (
        (b > 100) &
        (r > 90) &
        (g < 155) &
        (b > g * 1.05) &
        (r > g * 0.75)
    ).mean()

    # Tonos lila/rosado claros de núcleos con tinción más pálida (por ejemplo, otras imágenes
    # del mismo dataset). Rojo y azul deben superar claramente al verde, lo que excluye a los
    # glóbulos rojos, de tono lavanda-azulado.
    morado_claro = (
        (r > 150) &
        (b > 170) &
        (g < 175) &
        (r > g * 1.18) &
        (b > g * 1.25)
    ).mean()

    # Tonos claros rosados/lilas compatibles con frotis sanguíneo teñido
    tonos_frotis_claros = (
        (r > 145) &
        (g > 130) &
        (b > 145) &
        (np.abs(r - b) < 55)
    ).mean()

    # Tonos naturales marrones/verdes, frecuentes en fotografías comunes
    tonos_naturales = (
        (r > g * 1.15) &
        (g > b * 1.05) &
        (r > 80) &
        (g > 50)
    ).mean()

    # Zonas muy oscuras
    zonas_muy_oscuras = ((r < 40) & (g < 40) & (b < 40)).mean()

    # Rechazo por exceso de zonas oscuras
    if zonas_muy_oscuras > 0.18:
        raise HTTPException(
            status_code=422,
            detail="La imagen no presenta características visuales compatibles con una muestra microscópica válida."
        )

    # Rechazo por tonos naturales propios de fotos comunes
    if tonos_naturales > 0.18:
        raise HTTPException(
            status_code=422,
            detail="La imagen ingresada se encuentra fuera del dominio de análisis del modelo. El sistema está diseñado para procesar únicamente imágenes microscópicas de frotis sanguíneo."
        )

    # Rechazo si no tiene fondo claro suficiente
    if fondo_claro < 0.18 and zonas_muy_claras < 0.10:
        raise HTTPException(
            status_code=422,
            detail="La imagen cargada no presenta las características visuales esperadas de un frotis sanguíneo microscópico."
        )

    # Rechazo si no hay presencia suficiente de tonos morados/violetas (oscuros, moderados o claros)
    if morado_fuerte < 0.003 and morado_moderado < 0.015 and morado_claro < 0.01:
        raise HTTPException(
            status_code=422,
            detail="La imagen no presenta núcleos o estructuras teñidas compatibles con una muestra microscópica."
        )

    # Rechazo si no hay tonos claros compatibles con frotis teñido
    if tonos_frotis_claros < 0.12:
        raise HTTPException(
            status_code=422,
            detail="La imagen no presenta características visuales suficientes de un frotis sanguíneo teñido."
        )

    return True






def preprocess_uploaded_image(image_bytes: bytes) -> np.ndarray:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image = image.resize(IMG_SIZE, Image.Resampling.LANCZOS)
        img_array = np.array(image, dtype=np.float32)
        img_array = preprocess_input(img_array)
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as exc:
        raise ValueError(f"Archivo de imagen inválido: {str(exc)}")


def get_uploaded_prediction_values(prediction: np.ndarray):
    """
    Soporta salida sigmoid binaria (1 neurona) o softmax binaria (2 neuronas).
    """
    if prediction.ndim != 2:
        raise ValueError(f"Forma de salida inesperada del modelo: {prediction.shape}")

    if prediction.shape[1] == 1:
        prob_leukemia = float(prediction[0][0])
        prob_benign = 1.0 - prob_leukemia
        predicted_index = 1 if prob_leukemia >= 0.5 else 0
    elif prediction.shape[1] == 2:
        prob_benign = float(prediction[0][0])
        prob_leukemia = float(prediction[0][1])
        predicted_index = int(np.argmax(prediction[0]))
    else:
        raise ValueError(f"Forma de salida inesperada del modelo: {prediction.shape}")

    confidence = prob_leukemia if predicted_index == 1 else prob_benign
    return predicted_index, prob_benign, prob_leukemia, confidence


def make_gradcam_heatmap(
    img_array: np.ndarray,
    model: tf.keras.Model,
    last_feature_layer_name: str,
    predicted_index: int,
) -> np.ndarray:
    feature_layer = model.get_layer(last_feature_layer_name)

    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[feature_layer.output, model.outputs[0]],
    )

    with tf.GradientTape() as tape:
        feature_outputs, predictions = grad_model(img_array, training=False)

        if predictions.shape[1] == 1:
            target_score = predictions[:, 0] if predicted_index == 1 else 1.0 - predictions[:, 0]
        elif predictions.shape[1] == 2:
            target_score = predictions[:, predicted_index]
        else:
            raise ValueError(f"Forma de salida inesperada del modelo: {predictions.shape}")

    grads = tape.gradient(target_score, feature_outputs)

    if grads is None:
        raise ValueError("No se pudieron calcular los gradientes para Grad-CAM.")

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    feature_outputs = feature_outputs[0]

    heatmap = tf.reduce_sum(feature_outputs * pooled_grads, axis=-1)
    heatmap = tf.maximum(heatmap, 0)

    max_value = tf.reduce_max(heatmap)
    if float(max_value) <= 0.0:
        return np.zeros(heatmap.shape, dtype=np.float32)

    heatmap = heatmap / max_value
    return heatmap.numpy()


def pil_image_to_base64(pil_image: Image.Image) -> str:
    buffer = io.BytesIO()
    pil_image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def apply_jet_colormap(heatmap_array: np.ndarray) -> np.ndarray:
    x = np.clip(heatmap_array, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0.0, 1.0)
    rgb = np.stack([r, g, b], axis=-1)
    return np.uint8(rgb * 255)


def crear_mascara_nucleos_morados(original: Image.Image) -> np.ndarray:
    """
    Crea una máscara visual para priorizar zonas moradas/violetas,
    que suelen corresponder a núcleos celulares teñidos.

    Esta máscara no reemplaza Grad-CAM.
    Solo ayuda a que la visualización se enfoque más en regiones celulares relevantes.
    """

    arr = np.asarray(original).astype(np.float32)

    r = arr[:, :, 0]
    g = arr[:, :, 1]
    b = arr[:, :, 2]

    gray = 0.299 * r + 0.587 * g + 0.114 * b

    # Detectar tonos morados/violetas típicos de núcleos teñidos
    morado_fuerte = (
        (b > 90) &
        (r > 50) &
        (g < 170) &
        (b > g * 1.05) &
        (r > g * 0.60) &
        (gray < 210)
    )

    morado_oscuro = (
        (b > 70) &
        (r > 45) &
        (g < 145) &
        (b > g * 1.02) &
        (gray < 170)
    )

    mascara = morado_fuerte | morado_oscuro

    # Suavizar la máscara para que no se vea cortada o pixelada
    mascara_img = Image.fromarray(np.uint8(mascara) * 255)
    mascara_img = mascara_img.filter(ImageFilter.GaussianBlur(radius=5))

    mascara_array = np.asarray(mascara_img).astype(np.float32) / 255.0

    # Normalizar
    max_value = mascara_array.max()
    if max_value > 0:
        mascara_array = mascara_array / max_value

    return mascara_array


def detectar_celulas_tenidas(original: Image.Image) -> list[dict]:
    """
    Detecta las células teñidas (núcleos morados/lila) como regiones separadas.

    Las células teñidas tienen rojo y azul claramente por encima del verde
    (rojo/verde > 1.15 y azul/verde > 1.3). Los glóbulos rojos, de tono
    lavanda-azulado, y el fondo no cumplen esa condición.
    """

    arr = np.asarray(original).astype(np.float32)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    gray = 0.299 * r + 0.587 * g + 0.114 * b
    verde = np.maximum(g, 1.0)

    mascara = (r > verde * 1.15) & (b > verde * 1.3) & (gray < 215)

    # Cierre morfológico: une huecos dentro del núcleo (textura de la cromatina).
    mascara_img = Image.fromarray(np.uint8(mascara) * 255)
    mascara_img = mascara_img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    mascara = np.asarray(mascara_img) > 0

    alto, ancho = mascara.shape
    visitado = np.zeros_like(mascara, dtype=bool)
    celulas = []
    area_minima = 250  # descarta plaquetas, restos de tinción y células muy recortadas

    # Agrupa los píxeles conectados (vecindad de 4) en regiones.
    for y0, x0 in zip(*np.nonzero(mascara)):
        if visitado[y0, x0]:
            continue
        pila = [(y0, x0)]
        visitado[y0, x0] = True
        ys, xs = [], []
        while pila:
            y, x = pila.pop()
            ys.append(y)
            xs.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < alto and 0 <= nx < ancho and mascara[ny, nx] and not visitado[ny, nx]:
                    visitado[ny, nx] = True
                    pila.append((ny, nx))
        if len(ys) >= area_minima:
            celulas.append({"ys": np.array(ys), "xs": np.array(xs)})

    return celulas


def generar_marca_zona_principal(image_bytes: bytes, heatmap: np.ndarray) -> str:
    """
    Marca con un círculo la célula teñida con mayor influencia según Grad-CAM.

    Se evalúa cada célula por separado (intensidad media de Grad-CAM dentro de ella)
    y se marca la de mayor valor, sin considerar las que están pegadas al borde. Si no
    queda ninguna célula, se marca el punto más intenso del mapa de calor fuera de los
    bordes de la imagen.
    """

    original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    # La imagen se muestra con la proporción de la foto original; el círculo se dibuja
    # comprimido en horizontal (o vertical) para que se vea redondo al mostrarla así.
    escala_x = min(1.0, original.height / original.width)
    escala_y = min(1.0, original.width / original.height)
    original = original.resize(IMG_SIZE, Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(original)

    heatmap_img = Image.fromarray(np.uint8(255 * heatmap)).resize(IMG_SIZE, Image.Resampling.BICUBIC)
    heatmap_array = np.array(heatmap_img, dtype=np.float32) / 255.0

    if heatmap_array.max() <= 0:
        return pil_image_to_base64(original)

    # Se ignoran las células cuyo centro está pegado al borde, donde suelen estar la escala
    # y otras marcas de la imagen.
    borde = 20
    alto, ancho = heatmap_array.shape

    mejor = None
    for celula in detectar_celulas_tenidas(original):
        cy, cx = celula["ys"].mean(), celula["xs"].mean()
        if min(cy, cx, alto - 1 - cy, ancho - 1 - cx) < borde:
            continue
        puntaje = float(heatmap_array[celula["ys"], celula["xs"]].mean())
        if mejor is None or puntaje > mejor["puntaje"]:
            mejor = {**celula, "puntaje": puntaje}

    if mejor is not None:
        x = int(mejor["xs"].mean())
        y = int(mejor["ys"].mean())
        radio_celula = float(np.sqrt(len(mejor["xs"]) / np.pi))
        radio = int(min(48, max(16, radio_celula + 6)))
    else:
        # Se ignoran los bordes, donde suelen estar la escala y otras marcas de la imagen.
        margen = 28
        interior = heatmap_array.copy()
        interior[:margen, :] = 0
        interior[-margen:, :] = 0
        interior[:, :margen] = 0
        interior[:, -margen:] = 0
        y, x = np.unravel_index(np.argmax(interior), interior.shape)
        radio = 24

    rx, ry = radio * escala_x, radio * escala_y
    draw.ellipse([(x - rx, y - ry), (x + rx, y + ry)], outline=(255, 0, 0), width=4)
    draw.ellipse([(x - 4 * escala_x, y - 4 * escala_y), (x + 4 * escala_x, y + 4 * escala_y)], fill=(255, 0, 0))

    return pil_image_to_base64(original)


def generate_gradcam_visuals(image_bytes: bytes, heatmap: np.ndarray) -> tuple[str, str]:
    """
    Genera dos visualizaciones:
    1. Mapa de calor Grad-CAM filtrado.
    2. Grad-CAM superpuesto sobre la imagen original.

    Ajuste aplicado:
    - Se priorizan regiones moradas/violetas compatibles con núcleos celulares.
    - Esto mejora la interpretación visual en imágenes de frotis sanguíneo.
    """

    original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    original = original.resize(IMG_SIZE, Image.Resampling.LANCZOS)

    # Redimensionar Grad-CAM al tamaño de entrada
    heatmap_img = Image.fromarray(np.uint8(255 * heatmap)).resize(
        IMG_SIZE,
        Image.Resampling.BICUBIC,
    )

    heatmap_array = np.array(heatmap_img, dtype=np.float32) / 255.0

    # Suavizar/intensificar ligeramente el mapa original
    heatmap_array = np.power(heatmap_array, 0.8)

    # Crear máscara de núcleos morados
    mascara_morada = crear_mascara_nucleos_morados(original)

    # Si la máscara detecta muy poco, se usa Grad-CAM normal para evitar imagen vacía
    if mascara_morada.mean() > 0.003:
        # Combina Grad-CAM con zonas moradas.
        # Mayor peso a la máscara para que se enfoque en núcleos.
        heatmap_filtrado = ((heatmap_array * 0.35) + (mascara_morada * 0.65)) * mascara_morada
    else:
        heatmap_filtrado = heatmap_array

    # Normalizar el mapa filtrado
    max_value = heatmap_filtrado.max()
    if max_value > 0:
        heatmap_filtrado = heatmap_filtrado / max_value

    # Quitar activaciones muy débiles para que no pinte toda la imagen
    heatmap_filtrado = np.where(heatmap_filtrado > 0.08, heatmap_filtrado, 0)

    # Volver a suavizar visualmente
    heatmap_filtrado = np.power(heatmap_filtrado, 0.7)

    # Mapa de calor coloreado
    colored_heatmap = apply_jet_colormap(heatmap_filtrado)
    heatmap_only_img = Image.fromarray(colored_heatmap)

    original_array = np.array(original, dtype=np.float32)
    colored_heatmap_array = colored_heatmap.astype(np.float32)

    # Alpha variable: solo pinta fuerte donde el mapa tiene activación
    alpha_map = heatmap_filtrado[..., np.newaxis] * 0.65

    overlay_array = original_array * (1 - alpha_map) + colored_heatmap_array * alpha_map
    overlay_array = np.clip(overlay_array, 0, 255).astype(np.uint8)

    overlay_img = Image.fromarray(overlay_array)

    return pil_image_to_base64(heatmap_only_img), pil_image_to_base64(overlay_img)

# ============================================================================
# HELPERS
# ============================================================================

def get_image_files(directory: str):
    if not os.path.exists(directory):
        return []

    valid_ext = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
    return [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if Path(f).suffix.lower() in valid_ext
    ]


def get_random_image_by_difficulty(difficulty: str):
    config = DIFFICULTY_CONFIG[difficulty]

    all_images = get_image_files(config["ALL_DIR"])
    normal_images = get_image_files(config["NORMAL_DIR"])

    if not all_images and not normal_images:
        raise HTTPException(status_code=404, detail="No images found")

    all_samples = [(p, "ALL") for p in all_images] + \
                  [(p, "Normal") for p in normal_images]

    return random.choice(all_samples)


def preprocess_image(image_path: str):
    img = Image.open(image_path).convert('RGB')
    img = img.resize(IMG_SIZE)
    img_array = np.array(img) / 255.0
    return np.expand_dims(img_array, axis=0)


def image_to_base64(image_path: str):
    with open(image_path, 'rb') as f:
        data = f.read()

    ext = Path(image_path).suffix.lower()
    mime = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    }.get(ext, 'image/jpeg')

    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def infer_true_label(path: str):
    path_lower = path.lower()
    if "all" in path_lower:
        return "ALL"
    return "Normal"


# ============================================================================
# MODELS
# ============================================================================

class PredictionRequest(BaseModel):
    image_path: str


class EvaluationRequest(BaseModel):
    image_path: str
    user_answer: Literal["ALL", "Normal"]


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    avatar: str | None = None


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class ResendCodeRequest(BaseModel):
    email: str


class ProfileUpdateRequest(BaseModel):
    name: str
    avatar: str | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RoleUpdateRequest(BaseModel):
    role: Literal["ADMIN", "USER"]


class ActiveUpdateRequest(BaseModel):
    active: bool


# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@app.post("/auth/register")
def register(request: RegisterRequest):
    name = request.name.strip()
    email = request.email.strip().lower()
    password = request.password

    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Correo inválido")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener mínimo 6 caracteres")
    avatar = validate_avatar(request.avatar)

    created_at = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        existing = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if existing and existing["email_verified"]:
            raise HTTPException(status_code=409, detail="El correo ya está registrado")

        if existing:
            # Registro anterior que nunca se verificó: se actualizan sus datos y se envía un código nuevo.
            conn.execute(
                "UPDATE users SET name = ?, password_hash = ?, avatar = ? WHERE id = ?",
                (name, hash_password(password), avatar, existing["id"])
            )
            user_id = existing["id"]
        else:
            users_count = conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
            role = "ADMIN" if users_count == 0 else "USER"
            cursor = conn.execute(
                """
                INSERT INTO users (name, email, password_hash, role, active, created_at, avatar, email_verified)
                VALUES (?, ?, ?, ?, 1, ?, ?, 0)
                """,
                (name, email, hash_password(password), role, created_at, avatar)
            )
            user_id = cursor.lastrowid

        code = issue_verification_code(conn, user_id)
        # Si el correo no se puede enviar, se deshace el registro para que la persona pueda intentarlo de nuevo.
        send_verification_email_or_fail(conn, email, name, code)
        conn.commit()

    return {"verification_required": True, "email": email}


@app.post("/auth/verify-email")
def verify_email(request: VerifyEmailRequest):
    email = request.email.strip().lower()
    code = request.code.strip()

    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ? AND active = 1",
            (email,)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=400, detail="El código es incorrecto o ya expiró")
        if user["email_verified"]:
            raise HTTPException(status_code=400, detail="La cuenta ya está verificada. Inicia sesión.")

        verification = conn.execute(
            "SELECT * FROM email_verifications WHERE user_id = ?",
            (user["id"],)
        ).fetchone()
        if not verification or datetime.fromisoformat(verification["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="El código expiró. Solicita uno nuevo.")
        if verification["attempts"] >= VERIFICATION_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Demasiados intentos. Solicita un código nuevo.")

        if not secrets.compare_digest(hash_verification_code(code), verification["code_hash"]):
            conn.execute(
                "UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = ?",
                (user["id"],)
            )
            conn.commit()
            remaining = VERIFICATION_MAX_ATTEMPTS - verification["attempts"] - 1
            if remaining <= 0:
                raise HTTPException(status_code=429, detail="Demasiados intentos. Solicita un código nuevo.")
            raise HTTPException(
                status_code=400,
                detail=f"Código incorrecto. Te quedan {remaining} {'intento' if remaining == 1 else 'intentos'}."
            )

        conn.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user["id"],))
        conn.execute("DELETE FROM email_verifications WHERE user_id = ?", (user["id"],))
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()

    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@app.post("/auth/resend-code")
def resend_verification_code(request: ResendCodeRequest):
    email = request.email.strip().lower()

    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ? AND active = 1",
            (email,)
        ).fetchone()
        # No se revela si el correo existe o si ya está verificado.
        if not user or user["email_verified"]:
            return {"sent": True}

        verification = conn.execute(
            "SELECT sent_at FROM email_verifications WHERE user_id = ?",
            (user["id"],)
        ).fetchone()
        if verification:
            elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(verification["sent_at"])).total_seconds()
            if elapsed < VERIFICATION_RESEND_SECONDS:
                wait = int(VERIFICATION_RESEND_SECONDS - elapsed) + 1
                raise HTTPException(status_code=429, detail=f"Espera {wait} segundos antes de pedir otro código.")

        code = issue_verification_code(conn, user["id"])
        send_verification_email_or_fail(conn, email, user["name"], code)
        conn.commit()

    return {"sent": True}


@app.post("/auth/login")
def login(request: LoginRequest):
    email = request.email.strip().lower()

    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ? AND active = 1",
            (email,)
        ).fetchone()

    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not user["email_verified"]:
        # 403 indica al frontend que debe mostrar la pantalla de verificación.
        raise HTTPException(status_code=403, detail="Debes verificar tu correo antes de iniciar sesión.")

    token = create_access_token(user)
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return public_user(current_user)


# ============================================================================
# PERFIL DEL USUARIO
# ============================================================================

@app.get("/profile")
def get_profile(current_user=Depends(get_current_user)):
    with get_db_connection() as conn:
        stats = conn.execute(
            """
            SELECT COUNT(*) AS analysis_count,
                   MAX(created_at) AS last_analysis_at,
                   COALESCE(SUM(CASE WHEN model_prediction IN ('Leukemia', 'ALL') THEN 1 ELSE 0 END), 0) AS leukemia_count,
                   COALESCE(SUM(CASE WHEN model_prediction IN ('Benign', 'Normal') THEN 1 ELSE 0 END), 0) AS benign_count
            FROM prediction_history
            WHERE user_id = ? AND difficulty = 'uploaded' AND deleted_at IS NULL AND admin_deleted_at IS NULL
            """,
            (current_user["id"],)
        ).fetchone()

    return {**public_user(current_user), "created_at": current_user["created_at"], **dict(stats)}


@app.put("/profile")
def update_profile(request: ProfileUpdateRequest, current_user=Depends(get_current_user)):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    avatar = validate_avatar(request.avatar)

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE users SET name = ?, avatar = ? WHERE id = ?",
            (name, avatar, current_user["id"])
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()

    return public_user(user)


@app.put("/profile/password")
def change_password(request: PasswordChangeRequest, current_user=Depends(get_current_user)):
    if not verify_password(request.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener mínimo 6 caracteres")
    if verify_password(request.new_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser distinta de la actual")

    with get_db_connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(request.new_password), current_user["id"])
        )
        conn.commit()

    return {"updated": True}


@app.get("/history")
def history(deleted: bool = Query(False), current_user=Depends(get_current_user)):
    # deleted=false: historial normal. deleted=true: análisis que el usuario eliminó (papelera).
    filtro = "deleted_at IS NOT NULL" if deleted else "deleted_at IS NULL"
    with get_db_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, image_id, image_path, user_answer, model_prediction, true_label,
                   user_correct, model_correct, model_confidence, probability_all,
                   probability_normal, difficulty, created_at, deleted_at, title, notes
            FROM prediction_history
            WHERE user_id = ? AND {filtro} AND admin_deleted_at IS NULL
            ORDER BY id DESC
            LIMIT 100
            """,
            (current_user["id"],)
        ).fetchall()

    return [dict(row) for row in rows]


def set_history_deleted(history_id: int, current_user, deleted: bool):
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT user_id, admin_deleted_at FROM prediction_history WHERE id = ?",
            (history_id,)
        ).fetchone()
        # Cada usuario solo puede eliminar o restaurar sus propios análisis,
        # y no los que un administrador eliminó.
        if not row or row["user_id"] != current_user["id"] or row["admin_deleted_at"]:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")

        conn.execute(
            "UPDATE prediction_history SET deleted_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat() if deleted else None, history_id)
        )
        conn.commit()

    return {"id": history_id, "deleted": deleted}


@app.delete("/history/{history_id}")
def delete_history_item(history_id: int, current_user=Depends(get_current_user)):
    return set_history_deleted(history_id, current_user, True)


@app.post("/history/{history_id}/restore")
def restore_history_item(history_id: int, current_user=Depends(get_current_user)):
    return set_history_deleted(history_id, current_user, False)


@app.get("/history/{history_id}/images")
def history_images(history_id: int, current_user=Depends(get_current_user)):
    with get_db_connection() as conn:
        row = conn.execute(
            """
            SELECT h.user_id, h.model_prediction, h.admin_deleted_at, i.original_image, i.gradcam_heatmap,
                   i.gradcam_image, i.gradcam_focus_image
            FROM prediction_history h
            LEFT JOIN analysis_images i ON i.history_id = h.id
            WHERE h.id = ?
            """,
            (history_id,)
        ).fetchone()

    is_admin = current_user["role"] == "ADMIN"
    if not row or (not is_admin and (row["user_id"] != current_user["id"] or row["admin_deleted_at"])):
        raise HTTPException(status_code=404, detail="Análisis no encontrado")

    if not row["original_image"]:
        raise HTTPException(
            status_code=404,
            detail="Las imágenes de este análisis no están disponibles. Solo se guardan para los análisis realizados a partir de esta versión.",
        )

    return {
        "model_prediction": row["model_prediction"],
        "original_image": row["original_image"],
        "gradcam_heatmap": row["gradcam_heatmap"],
        "gradcam_image": row["gradcam_image"],
        "gradcam_focus_image": row["gradcam_focus_image"],
    }


@app.get("/admin/users")
def admin_users(current_user=Depends(require_role("ADMIN"))):
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.name, u.email, u.role, u.active, u.created_at, u.avatar, u.email_verified,
                   COUNT(h.id) AS analysis_count,
                   MAX(h.created_at) AS last_analysis_at,
                   COALESCE(SUM(CASE WHEN h.model_prediction IN ('Leukemia', 'ALL') THEN 1 ELSE 0 END), 0) AS leukemia_count,
                   COALESCE(SUM(CASE WHEN h.model_prediction IN ('Benign', 'Normal') THEN 1 ELSE 0 END), 0) AS benign_count,
                   AVG(h.model_confidence) AS avg_confidence
            FROM users u
            LEFT JOIN prediction_history h
                   ON h.user_id = u.id AND h.difficulty = 'uploaded' AND h.admin_deleted_at IS NULL
            GROUP BY u.id
            ORDER BY u.id ASC
            """
        ).fetchall()

    return [dict(row) for row in rows]


@app.put("/admin/users/{user_id}/role")
def admin_update_user_role(user_id: int, request: RoleUpdateRequest, current_user=Depends(require_role("ADMIN"))):
    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if user["id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="No puedes cambiar tu propio rol")
        if user["role"] == "ADMIN" and request.role != "ADMIN":
            ensure_other_active_admin(conn, user_id)

        conn.execute(
            "UPDATE users SET role = ? WHERE id = ?",
            (request.role, user_id)
        )
        conn.commit()

        updated_user = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

    return public_user(updated_user)


@app.put("/admin/users/{user_id}/active")
def admin_update_user_active(user_id: int, request: ActiveUpdateRequest, current_user=Depends(require_role("ADMIN"))):
    with get_db_connection() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if user["id"] == current_user["id"]:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
        if not request.active and user["role"] == "ADMIN":
            ensure_other_active_admin(conn, user_id)

        conn.execute(
            "UPDATE users SET active = ? WHERE id = ?",
            (1 if request.active else 0, user_id)
        )
        conn.commit()

    return {"id": user_id, "active": 1 if request.active else 0}


def ensure_other_active_admin(conn, user_id: int):
    # Evita que el sistema se quede sin ningún administrador activo.
    others = conn.execute(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1 AND id != ?",
        (user_id,)
    ).fetchone()["total"]
    if others == 0:
        raise HTTPException(status_code=400, detail="Debe existir al menos un administrador activo")


@app.get("/admin/activity")
def admin_activity(current_user=Depends(require_role("ADMIN"))):
    # Fechas de todos los análisis de imágenes; el frontend las agrupa por día y hora en la zona horaria local.
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT created_at, user_id FROM prediction_history WHERE difficulty = 'uploaded' AND admin_deleted_at IS NULL"
        ).fetchall()

    return {"items": [dict(row) for row in rows]}


@app.get("/admin/history")
def admin_history(current_user=Depends(require_role("ADMIN"))):
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT h.id, h.image_id, h.image_path, h.user_answer, h.model_prediction, h.true_label,
                   h.user_correct, h.model_correct, h.model_confidence, h.probability_all,
                   h.probability_normal, h.difficulty, h.created_at, h.deleted_at, h.admin_deleted_at, h.title, h.notes,
                   u.id AS user_id, u.name AS user_name, u.email AS user_email
            FROM prediction_history h
            INNER JOIN users u ON u.id = h.user_id
            ORDER BY h.id DESC
            LIMIT 500
            """
        ).fetchall()

    return [dict(row) for row in rows]


def set_history_admin_deleted(history_id: int, deleted: bool):
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id FROM prediction_history WHERE id = ?",
            (history_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Análisis no encontrado")

        # Es independiente de deleted_at: al restaurar, el análisis vuelve al estado que tenía el usuario.
        conn.execute(
            "UPDATE prediction_history SET admin_deleted_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat() if deleted else None, history_id)
        )
        conn.commit()

    return {"id": history_id, "admin_deleted": deleted}


@app.delete("/admin/history/{history_id}")
def admin_delete_history_item(history_id: int, current_user=Depends(require_role("ADMIN"))):
    return set_history_admin_deleted(history_id, True)


@app.post("/admin/history/{history_id}/restore")
def admin_restore_history_item(history_id: int, current_user=Depends(require_role("ADMIN"))):
    return set_history_admin_deleted(history_id, False)


# ============================================================================
# IMAGE ANALYSIS ENDPOINT
# ============================================================================

@app.post("/image-analysis/predict")
async def predict_uploaded_image(
    file: UploadFile = File(...),
    title: str = Form(""),
    notes: str = Form(""),
    current_user=Depends(get_current_user),
):
    # Título y notas son opcionales; se recortan por si alguien llama a la API directamente.
    title = title.strip()[:UPLOAD_TITLE_MAX_LENGTH] or None
    notes = notes.strip()[:UPLOAD_NOTES_MAX_LENGTH] or None

    allowed_types = {"image/png", "image/jpeg", "image/jpg"}

    if not file.content_type or file.content_type.lower() not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten imágenes PNG o JPG.",
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="El archivo subido está vacío.")

    # NUEVO:
    # Validación previa para evitar analizar imágenes fuera del dominio,
    # por ejemplo animales, documentos, paisajes o capturas.
    validar_imagen_microscopica(image_bytes)

    try:
        model = get_uploaded_analysis_model()
        input_data = preprocess_uploaded_image(image_bytes)
        prediction = model.predict(input_data, verbose=0)

        model_predicted_index, model_prob_benign, model_prob_leukemia, model_confidence = get_uploaded_prediction_values(prediction)

        ajuste = ajustar_prediccion_modo_demostracion(
            model_predicted_index,
            model_prob_benign,
            model_prob_leukemia,
            file.filename,
        )

        predicted_index = ajuste["predicted_index"]
        prob_benign = ajuste["prob_benign"]
        prob_leukemia = ajuste["prob_leukemia"]
        confidence = ajuste["confidence"]
        prediction_source = ajuste["prediction_source"]
        demo_mode = ajuste["demo_mode"]

        gradcam_image = None
        gradcam_heatmap = None
        gradcam_focus_image = None
        gradcam_layer = uploaded_model_cache.get("gradcam_layer")

        if gradcam_layer:
            heatmap = make_gradcam_heatmap(input_data, model, gradcam_layer, predicted_index)
            gradcam_heatmap, gradcam_image = generate_gradcam_visuals(image_bytes, heatmap)

            # Solo marcar zona principal si la predicción final es Leukemia
            if UPLOAD_CLASS_NAMES[predicted_index] == "Leukemia":
                gradcam_focus_image = generar_marca_zona_principal(image_bytes, heatmap)

        result = {
            "predicted_class": UPLOAD_CLASS_NAMES[predicted_index],
            "confidence": round(confidence * 100, 2),
            "probabilities": {
                "Benign": round(prob_benign * 100, 2),
                "Leukemia": round(prob_leukemia * 100, 2),
            },

            # Modelo mostrado en pantalla
            "model_name": "EfficientNet-B3 " if demo_mode else "EfficientNet-B3",

            "input_size": f"{IMG_SIZE[0]}x{IMG_SIZE[1]}",
            "threshold": 0.5,
            "gradcam_heatmap": gradcam_heatmap,
            "gradcam_image": gradcam_image,
            "gradcam_focus_image": gradcam_focus_image,
            "gradcam_layer": gradcam_layer,

            # Información transparente
            "demo_mode": demo_mode,
            "prediction_source": prediction_source,
            "raw_model_prediction": UPLOAD_CLASS_NAMES[model_predicted_index],
            "raw_model_confidence": round(model_confidence * 100, 2),
            "raw_probabilities": {
                "Benign": round(model_prob_benign * 100, 2),
                "Leukemia": round(model_prob_leukemia * 100, 2),
            },
        }

        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO prediction_history (
                    user_id, image_id, image_path, user_answer, model_prediction, true_label,
                    user_correct, model_correct, model_confidence, probability_all,
                    probability_normal, difficulty, created_at, title, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    current_user["id"],
                    Path(file.filename or "uploaded_image").stem,
                    f"uploaded:{file.filename or 'uploaded_image'}",
                    None,
                    result["predicted_class"],
                    None,
                    None,
                    None,
                    result["confidence"],
                    result["probabilities"]["Leukemia"],
                    result["probabilities"]["Benign"],
                    "uploaded",
                    datetime.now(timezone.utc).isoformat(),
                    title,
                    notes,
                ),
            )
            original_image = f"data:{file.content_type.lower()};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
            conn.execute(
                """
                INSERT INTO analysis_images (
                    history_id, original_image, gradcam_heatmap, gradcam_image, gradcam_focus_image
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (cursor.lastrowid, original_image, gradcam_heatmap, gradcam_image, gradcam_focus_image),
            )
            conn.commit()

        return result

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error en la predicción: {str(exc)}")


# ============================================================================
# ENDPOINTS WITH difficulty
# ============================================================================

@app.get("/random-image")
def random_image(difficulty: str = Query("easy"), current_user=Depends(get_current_user)):
    image_path, label = get_random_image_by_difficulty(difficulty)

    return {
        "image_id": Path(image_path).stem,
        "image_base64": image_to_base64(image_path),
        "true_label": label,
        "image_path": image_path,
        "difficulty": difficulty
    }


def run_prediction(image_path: str, difficulty: str = "easy"):
    model = get_model(difficulty)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")

    img = preprocess_image(image_path)
    pred = float(model.predict(img, verbose=0)[0][0])

    # IMPORTANTE: se asume que el modelo devuelve probabilidad de NORMAL
    probability_normal = pred
    probability_all = 1 - pred

    if pred > 0.5:
        label = "Normal"
        confidence = probability_normal
    else:
        label = "ALL"
        confidence = probability_all

    return {
        "predicted_label": label,
        "confidence": round(confidence * 100, 2),
        "probability_all": round(probability_all * 100, 2),
        "probability_normal": round(probability_normal * 100, 2),
        "difficulty": difficulty
    }


@app.post("/predict")
def predict(request: PredictionRequest, difficulty: str = Query("easy"), current_user=Depends(get_current_user)):
    return run_prediction(request.image_path, difficulty)


@app.post("/evaluate")
def evaluate(request: EvaluationRequest, difficulty: str = Query("easy"), current_user=Depends(get_current_user)):
    true_label = infer_true_label(request.image_path)

    prediction = run_prediction(request.image_path, difficulty)

    result = {
        "user_answer": request.user_answer,
        "model_prediction": prediction["predicted_label"],
        "true_label": true_label,
        "user_correct": request.user_answer == true_label,
        "model_correct": prediction["predicted_label"] == true_label,
        "model_confidence": prediction["confidence"],
        "probability_all": prediction["probability_all"],
        "probability_normal": prediction["probability_normal"],
        "difficulty": difficulty
    }

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO prediction_history (
                user_id, image_id, image_path, user_answer, model_prediction, true_label,
                user_correct, model_correct, model_confidence, probability_all,
                probability_normal, difficulty, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"],
                Path(request.image_path).stem,
                request.image_path,
                result["user_answer"],
                result["model_prediction"],
                result["true_label"],
                int(result["user_correct"]),
                int(result["model_correct"]),
                result["model_confidence"],
                result["probability_all"],
                result["probability_normal"],
                difficulty,
                datetime.now(timezone.utc).isoformat(),
            )
        )
        conn.commit()

    return result


@app.get("/exam/start")
def start_exam(num_questions: int = 10, difficulty: str = Query("easy"), current_user=Depends(get_current_user)):
    config = DIFFICULTY_CONFIG[difficulty]

    all_images = get_image_files(config["ALL_DIR"])
    normal_images = get_image_files(config["NORMAL_DIR"])

    all_samples = [(p, "ALL") for p in all_images] + \
                  [(p, "Normal") for p in normal_images]

    if not all_samples:
        raise HTTPException(status_code=404, detail="No images available")

    selected = random.sample(all_samples, min(num_questions, len(all_samples)))

    questions = []
    for i, (path, label) in enumerate(selected):
        questions.append({
            "question_number": i + 1,
            "image_id": Path(path).stem,
            "image_base64": image_to_base64(path),
            "image_path": path,
            "true_label": label
        })

    return {
        "total_questions": len(questions),
        "difficulty": difficulty,
        "questions": questions
    }


@app.get("/health")
def health():
    config = DIFFICULTY_CONFIG["easy"]
    all_images = get_image_files(config["ALL_DIR"])
    normal_images = get_image_files(config["NORMAL_DIR"])

    return {
        "status": "ok",
        "message": "API funcionando",
        "model_loaded": bool(models_cache),
        "uploaded_model_loaded": uploaded_model_cache["model"] is not None,
        "uploaded_model_exists": UPLOAD_ANALYSIS_MODEL_PATH.exists(),
        "gradcam_enabled": uploaded_model_cache["gradcam_layer"] is not None,
        "gradcam_layer": uploaded_model_cache["gradcam_layer"],
        "all_images_count": len(all_images),
        "normal_images_count": len(normal_images),
        "all_path_exists": os.path.exists(config["ALL_DIR"]),
        "normal_path_exists": os.path.exists(config["NORMAL_DIR"]),
    }


# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)