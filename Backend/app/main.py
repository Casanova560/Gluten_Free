from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

# Routers
from .routers import (
    uom,
    productos,
    contactos,
    ventas,
    compras,
    recetas,
    produccion,
    inventario,
    finanzas,
    costos,
    costeo,
    planilla,
    reportes,
)

app = FastAPI(title="GlutenFree ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar routers
app.include_router(uom.router)
app.include_router(productos.router)
app.include_router(contactos.router)
app.include_router(ventas.router)
app.include_router(compras.router)
app.include_router(recetas.router)
app.include_router(produccion.router)
app.include_router(inventario.router)
app.include_router(finanzas.router)
app.include_router(costos.router)      # /costos/mp
app.include_router(costeo.router)      # /costeo/recetas/{id}, /costeo/tandas/{id}
app.include_router(planilla.router)
app.include_router(reportes.router)

# Alias compatibles para costeo
costeo_alias = APIRouter(prefix="/costeo", tags=["costeo"])

@costeo_alias.get("/recetas/{receta_id}")
def costeo_receta_alias(
    receta_id: int,
    rendimiento: float | None = None,
    porcentaje_indirecto: float | None = None,
):
    params = []
    if rendimiento is not None:
        params.append(f"rendimiento={rendimiento}")
    if porcentaje_indirecto is not None:
        params.append(f"pct_ind={porcentaje_indirecto}")
    qs = f"?{'&'.join(params)}" if params else ""
    return RedirectResponse(url=f"/costeo/recetas/{receta_id}{qs}", status_code=307)

@costeo_alias.get("/tandas/{tanda_id}")
def costeo_tanda_alias(tanda_id: int):
    return RedirectResponse(url=f"/costeo/tandas/{tanda_id}", status_code=307)

app.include_router(costeo_alias)

@app.get("/")
def root():
    return {"ok": True, "app": "GlutenFree ERP API"}
