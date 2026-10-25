# Proyecto final integrado

Arquitectura aplicada:

- Público:
  - Inicio
  - Sobre mí / Sobre el proyecto
  - Login
- Después del login:
  - Dashboard principal
  - 1. Análisis de imágenes
  - 2. Laboratorio virtual
  - 3. Historial
  - 4. Panel administrativo solo para usuarios ADMIN

## Decisiones aplicadas

1. Se usó `v2_auth_roles` como base porque ya tenía login, JWT, roles, SQLite e historial.
2. Se integró el módulo Grad-CAM del otro proyecto como primera opción del dashboard.
3. El endpoint de análisis libre se dejó separado como:

```txt
POST /image-analysis/predict
```

Así no choca con el endpoint original del laboratorio:

```txt
POST /predict
```

4. El frontend del análisis de imágenes ahora manda el token JWT en el header `Authorization`.
5. El modelo Grad-CAM se dejó en:

```txt
backend/models/efficientnetb3_binary_best.keras
```

## Cómo ejecutar

### Backend

```bash
cd backend
uv run uvicorn main:app --reload
```

O si usas pip/venv tradicional:

```bash
pip install fastapi uvicorn tensorflow pillow numpy python-multipart pyjwt
uvicorn main:app --reload
```

### Frontend

```bash
npm install
npm run dev
```

## Variables opcionales

Si quieres cambiar rutas sin tocar el código, puedes usar variables de entorno:

```txt
UPLOAD_ANALYSIS_MODEL_PATH
EASY_ALL_DIR
EASY_NORMAL_DIR
EASY_MODEL_PATH
HARD_ALL_DIR
HARD_NORMAL_DIR
HARD_MODEL_PATH
JWT_SECRET
```

## Notas

- El primer usuario registrado será ADMIN automáticamente.
- Los siguientes usuarios serán USER.
- El módulo de análisis de imágenes guarda registros en el historial con dificultad `uploaded`.

