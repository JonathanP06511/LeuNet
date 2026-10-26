# LeuNet

Sistema de apoyo para el análisis y la clasificación de imágenes microscópicas de células sanguíneas, orientado a la identificación de **leucemia linfoblástica aguda (LLA)**.

LeuNet es un prototipo desarrollado como parte de un trabajo de tesis en la Universidad Central del Ecuador. Clasifica imágenes de frotis sanguíneo mediante un modelo de aprendizaje profundo basado en **EfficientNet-B3** y aplica **Grad-CAM** para mostrar qué regiones de la imagen influyeron en cada predicción.

> **Aviso:** LeuNet es una herramienta académica de apoyo. **No reemplaza el diagnóstico médico profesional.** Sus resultados deben ser revisados por un profesional de salud capacitado.

## Funcionalidades

- **Análisis de imágenes:** clasifica una imagen como *compatible con LLA* o *sin indicios de LLA*, con su nivel de confianza.
- **Interpretabilidad con Grad-CAM:** mapa de calor y región de mayor influencia en la predicción.
- **Reportes en PDF:** reporte descargable con el resultado, la confianza, las imágenes y los datos del usuario.
- **Historial:** consulta de análisis anteriores, con sus imágenes y su reporte.
- **Cuentas de usuario:** registro con verificación por correo electrónico (código de 6 dígitos) y foto de perfil.
- **Mi perfil:** edición de nombre, foto y contraseña, con un resumen de la actividad del usuario.
- **Panel administrativo:** gestión de roles y cuentas, mapa de actividad por día y hora, e historial general.
- **Guía de uso:** cómo realizar un análisis, qué imágenes subir, cómo interpretar el resultado y preguntas frecuentes.
- **Modo claro y oscuro.**

## Modelo y datos

| | |
|---|---|
| Arquitectura | EfficientNet-B3 (clasificación binaria) |
| Conjunto de datos | Blood Cells Cancer (ALL) |
| Tinción de las imágenes | May-Grünwald-Giemsa (MGG) |
| Tamaño de entrada | 300 × 300 píxeles |
| Interpretabilidad | Grad-CAM |

El modelo entrenado se incluye en `backend/models/efficientnetb3_binary.keras`.

## Tecnologías

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, componentes shadcn/ui, jsPDF.
- **Backend:** Python, FastAPI, TensorFlow/Keras, Pillow, SQLite, autenticación con JWT.
- **Correo:** envío de códigos de verificación mediante Gmail SMTP.

## Estructura del proyecto

```txt
.
├── app/                  # Páginas de Next.js (inicio, acerca de, guía y panel)
├── components/           # Componentes de la interfaz
│   ├── image-analysis/   # Subida de imágenes y resultados con Grad-CAM
│   └── ui/               # Componentes base (shadcn/ui)
├── lib/                  # Cliente de la API, generación del PDF y utilidades
├── public/               # Imágenes e ilustraciones
└── backend/
    ├── main.py           # API (FastAPI): autenticación, análisis, historial y administración
    ├── models/           # Modelo entrenado (.keras)
    └── pyproject.toml    # Dependencias de Python
```

## Requisitos

- **Node.js** 20 o superior.
- **Python** 3.12 o superior.
- Opcional: una cuenta de **Gmail** con verificación en dos pasos, para enviar los códigos de verificación.

## Instalación y ejecución

### 1. Backend

```bash
cd backend
uv run uvicorn main:app --reload
```

O con `pip`:

```bash
cd backend
pip install fastapi uvicorn tensorflow pillow numpy python-multipart pyjwt
uvicorn main:app --reload
```

La API queda disponible en `http://localhost:8000`. La base de datos `backend/users.db` se crea automáticamente la primera vez.

### 2. Frontend

En otra terminal, desde la carpeta raíz del proyecto:

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

## Configuración

El backend lee su configuración desde el archivo `backend/.env`. Este archivo **no se incluye en el repositorio**, porque contiene credenciales; créalo a partir de este ejemplo:

```env
# Verificación de cuentas por correo (Gmail SMTP)
SMTP_USER=tu.correo@gmail.com
# Contraseña de aplicación de Google (16 letras), no la contraseña normal de la cuenta
SMTP_PASSWORD=

# Clave para firmar los tokens de sesión (recomendado cambiarla)
JWT_SECRET=una-clave-larga-y-secreta
```

- La contraseña de aplicación se crea en <https://myaccount.google.com/apppasswords> (requiere tener activa la verificación en dos pasos).
- Si `SMTP_PASSWORD` está vacía, el backend no envía correos y muestra el código de verificación en su consola. Es útil para pruebas locales.
- Después de modificar `backend/.env` hay que reiniciar el backend.

Variables opcionales para cambiar rutas sin tocar el código: `UPLOAD_ANALYSIS_MODEL_PATH`, `EASY_ALL_DIR`, `EASY_NORMAL_DIR`, `EASY_MODEL_PATH`, `HARD_ALL_DIR`, `HARD_NORMAL_DIR`, `HARD_MODEL_PATH`, `SMTP_HOST` y `SMTP_PORT`.

## Primer uso

1. Abre `http://localhost:3000` y crea una cuenta desde **Iniciar sesión → Crear cuenta**.
2. Ingresa el código de verificación que llega al correo (o el que aparece en la consola del backend).
3. **El primer usuario registrado se convierte automáticamente en administrador.** Los siguientes se registran como usuarios normales; un administrador puede cambiar su rol desde el panel administrativo.

## Notas

- La base de datos (`backend/users.db`) y el archivo `backend/.env` están excluidos del repositorio mediante `.gitignore`, porque contienen datos de usuarios y credenciales.
- No se deben subir imágenes ni datos que permitan identificar a pacientes.
