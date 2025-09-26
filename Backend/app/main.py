# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GlutenFree ERP API", version="1.0.0")

# CORS amplio para el front local; ajusta dominios si publicas
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Registro de routers existentes (import condicional para evitar romper si alguno falta)
def _try_import(module_path, attr):
    try:
      mod = __import__(module_path, fromlist=[attr])
      return getattr(mod, attr)
    except Exception:
      return None

routers = [
    ("app.routers.uom", "router", "/uom", ["uom"]),
    ("app.routers.productos", "router", "/productos", ["productos"]),
    ("app.routers.contactos", "router", "/contactos", ["contactos"]),
    ("app.routers.ventas", "router", "/ventas", ["ventas"]),
    ("app.routers.compras", "router", "/compras", ["compras"]),
    ("app.routers.recetas", "router", "/recetas", ["recetas"]),
    ("app.routers.produccion", "router", "/produccion", ["produccion"]),
    ("app.routers.inventario", "router", "/inventario", ["inventario"]),
    ("app.routers.finanzas", "router", "/finanzas", ["finanzas"]),

    # Nuevos/actualizados
    ("app.routers.costeo", "router", "/costeo", ["costeo"]),
    ("app.routers.recetas_read", "router", "/recetas", ["recetas"]),  # solo añade GET ingredientes/salidas
    ("app.routers.indirectos", "router", "/finanzas", ["finanzas"]),
]

for module_path, attr, prefix, tags in routers:
    router = _try_import(module_path, attr)
    if router:
        app.include_router(router, prefix=prefix, tags=tags)

@app.get("/")
def root():
    return {"ok": True, "app": "GlutenFree ERP API"}
