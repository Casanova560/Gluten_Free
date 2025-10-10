# Gluten Free 3

Suite ligera para controlar inventario, recetas y producción. El proyecto tiene un backend FastAPI, un frontend vanilla JS y un script SQL para provisionar la base MySQL.

## Requisitos

- Python 3.11+
- MySQL 8.x
- Node.js 18+ (opcional, solo si prefieres servir el frontend con `npx serve` o similar)

## 1. Configurar entorno Python

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate       # En Windows PowerShell
pip install -r requirements.txt
```

### Variables de entorno

1. Copia el archivo `Backend/.env.example` a `Backend/.env` (ya existe una plantilla).
2. Ajusta `DB_USER`, `DB_PASS` y el resto de valores según tu instalación.
3. Alternativamente, exporta `DB_URL` con la cadena de conexión completa.

La aplicación no arranca si `DB_USER` o `DB_PASS` están vacíos y no definiste `DB_URL`.

## 2. Preparar la base de datos MySQL

1. Crea una sesión con un usuario con permisos de administración.
2. Antes de ejecutar el script SQL, define la contraseña que asignarás al usuario `gf_app`:
   ```sql
   SET @gf_app_password = 'TuClaveMuySegura';
   SOURCE database/database.sql;
   ```
3. Si ya tienes el esquema y solo quieres aplicar el patch incremental, ejecuta la sección de “PATCH sobre esquema existente” del mismo archivo (mismo paso previo de `SET @gf_app_password`).

## 3. Levantar el backend

Con el virtualenv activo y desde la carpeta raíz del repositorio:

```bash
uvicorn app.main:app --reload --app-dir Backend
```

La API quedará disponible en `http://localhost:8000`.

## 4. Servir el frontend

El frontend es estático. Puedes abrir `Frontend/index.html` directamente en el navegador o montarlo con cualquier servidor estático, por ejemplo:

```bash
npx serve Frontend
# o
python -m http.server 8080 --directory Frontend
```

Asegúrate de que la variable `API_BASE` definida en `Frontend/index.html` o inyectada por el entorno apunte al backend.

## 5. Buenas prácticas adicionales

- El archivo `.env` está en `.gitignore` para evitar filtrar credenciales. No lo añadas al repositorio.
- Revisa las configuraciones en `database/database.sql` si vas a desplegar en entornos distintos (roles, ubicaciones, triggers).
- Ajusta las reglas de CORS en `Backend/app/main.py` si sirves el frontend desde otro dominio.
