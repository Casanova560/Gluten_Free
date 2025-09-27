from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter(prefix="/contactos", tags=["contactos"])

@router.get("/clientes")
def list_clientes(q: str | None = Query(None), db = Depends(db_dep)):
    base = "SELECT id, nombre, num_doc, telefono, email, direccion, activo FROM cliente WHERE 1=1"
    params = {}
    if q:
        base += " AND (nombre LIKE :q OR num_doc LIKE :q)"
        params["q"] = f"%{q}%"
    base += " ORDER BY nombre"
    return db.execute(text(base), params).mappings().all()

@router.post("/clientes")
def create_cliente(payload: dict, db = Depends(db_dep)):
    fields = ["nombre", "num_doc", "telefono, email, direccion, activo".split(", ")]  # just for clarity
    data = {
        "nombre": payload.get("nombre"),
        "num_doc": payload.get("num_doc"),
        "telefono": payload.get("telefono"),
        "email": payload.get("email"),
        "direccion": payload.get("direccion"),
        "activo": 1 if str(payload.get("activo", "1")) in ("1","true","True") else 0,
    }
    if not (data["nombre"] or "").strip():
        raise HTTPException(400, "nombre requerido")
    res = db.execute(text("""
        INSERT INTO cliente (nombre, num_doc, telefono, email, direccion, activo)
        VALUES (:nombre, :num_doc, :telefono, :email, :direccion, :activo)
    """), data)
    db.commit()
    return db.execute(text("SELECT * FROM cliente WHERE id=:id"), {"id": res.lastrowid}).mappings().first()

@router.get("/proveedores")
def list_proveedores(q: str | None = Query(None), db = Depends(db_dep)):
    base = "SELECT id, nombre, num_doc, telefono, email, direccion, activo FROM proveedor WHERE 1=1"
    params = {}
    if q:
        base += " AND (nombre LIKE :q OR num_doc LIKE :q)"
        params["q"] = f"%{q}%"
    base += " ORDER BY nombre"
    return db.execute(text(base), params).mappings().all()

@router.post("/proveedores")
def create_proveedor(payload: dict, db = Depends(db_dep)):
    data = {
        "nombre": payload.get("nombre"),
        "num_doc": payload.get("num_doc"),
        "telefono": payload.get("telefono"),
        "email": payload.get("email"),
        "direccion": payload.get("direccion"),
        "activo": 1 if str(payload.get("activo", "1")) in ("1","true","True") else 0,
    }
    if not (data["nombre"] or "").strip():
        raise HTTPException(400, "nombre requerido")
    res = db.execute(text("""
        INSERT INTO proveedor (nombre, num_doc, telefono, email, direccion, activo)
        VALUES (:nombre, :num_doc, :telefono, :email, :direccion, :activo)
    """), data)
    db.commit()
    return db.execute(text("SELECT * FROM proveedor WHERE id=:id"), {"id": res.lastrowid}).mappings().first()

@router.get("/empleados")
def list_empleados(q: str | None = Query(None), db = Depends(db_dep)):
    base = "SELECT id, nombre, num_doc, telefono, email, direccion, activo FROM empleado WHERE 1=1"
    params = {}
    if q:
        base += " AND (nombre LIKE :q OR num_doc LIKE :q)"
        params["q"] = f"%{q}%"
    base += " ORDER BY nombre"
    return db.execute(text(base), params).mappings().all()

@router.post("/empleados")
def create_empleado(payload: dict, db = Depends(db_dep)):
    data = {
        "nombre": payload.get("nombre"),
        "num_doc": payload.get("num_doc"),
        "telefono": payload.get("telefono"),
        "email": payload.get("email"),
        "direccion": payload.get("direccion"),
        "activo": 1 if str(payload.get("activo", "1")) in ("1","true","True") else 0,
    }
    if not (data["nombre"] or "").strip():
        raise HTTPException(400, "nombre requerido")
    res = db.execute(text("""
        INSERT INTO empleado (nombre, num_doc, telefono, email, direccion, activo)
        VALUES (:nombre, :num_doc, :telefono, :email, :direccion, :activo)
    """), data)
    db.commit()
    return db.execute(text("SELECT * FROM empleado WHERE id=:id"), {"id": res.lastrowid}).mappings().first()
