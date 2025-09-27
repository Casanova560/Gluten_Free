# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import productos, recetas, produccion, finanzas

app = FastAPI(title="GlutenFree ERP API")

# CORS para tu front local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ajusta si quieres restringir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar routers
app.include_router(productos.router)
app.include_router(recetas.router)
app.include_router(produccion.router)
app.include_router(finanzas.router)

# Alias opcionales para que coincida exactamente con tu front:
# /costeo/recetas/{id} y /costeo/tandas/{id}
from fastapi import APIRouter
costeo = APIRouter(prefix="/costeo", tags=["costeo"])
@costeo.get("/recetas/{receta_id}")
async def costeo_receta_alias(receta_id: int, rendimiento: float | None = None, porcentaje_indirecto: float | None = None):
    # Importación perezosa para reutilizar la lógica del router de recetas
    from .routers.recetas import costear_receta
    return await costear_receta(receta_id, rendimiento, porcentaje_indirecto)  # FastAPI permite llamadas sync/async

@costeo.get("/tandas/{tanda_id}")
async def costeo_tanda_alias(tanda_id: int):
    from .routers.produccion import costear_tanda
    return await costear_tanda(tanda_id)
app.include_router(costeo)

@app.get("/")
def root():
    return {"ok": True, "app": "GlutenFree ERP API"}
