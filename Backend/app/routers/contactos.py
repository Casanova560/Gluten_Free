from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from ..utils.deps import db_dep



def _normalize_bool(value, default=None):
    if value is None:
        return default
    return 1 if str(value).strip().lower() in ("1","true","t","y","yes","si") else 0
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
    base = "SELECT id, nombre, num_doc, telefono, email, direccion, activo, tarifa_hora_crc FROM empleado WHERE 1=1"
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
        "tarifa_hora_crc": float(payload.get("tarifa_hora_crc") or 0),
        "activo": 1 if str(payload.get("activo", "1")) in ("1","true","True") else 0,
    }
    if not (data["nombre"] or "").strip():
        raise HTTPException(400, "nombre requerido")
    res = db.execute(text("""
        INSERT INTO empleado (nombre, num_doc, telefono, email, direccion, tarifa_hora_crc, activo)
        VALUES (:nombre, :num_doc, :telefono, :email, :direccion, :tarifa_hora_crc, :activo)
    """), data)
    db.commit()
    return db.execute(text("SELECT * FROM empleado WHERE id=:id"), {"id": res.lastrowid}).mappings().first()

@router.put("/clientes/{cliente_id}")
def update_cliente(cliente_id: int, payload: dict, db = Depends(db_dep)):
    exists = db.execute(text("SELECT id FROM cliente WHERE id=:id"), {"id": cliente_id}).first()
    if not exists:
        raise HTTPException(404, "cliente no encontrado")
    data = {
        "id": cliente_id,
        "nombre": payload.get("nombre"),
        "num_doc": payload.get("num_doc"),
        "telefono": payload.get("telefono"),
        "email": payload.get("email"),
        "direccion": payload.get("direccion"),
        "activo": _normalize_bool(payload.get("activo")),
    }
    db.execute(text("""
        UPDATE cliente SET
          nombre = COALESCE(:nombre, nombre),
          num_doc = COALESCE(:num_doc, num_doc),
          telefono = COALESCE(:telefono, telefono),
          email = COALESCE(:email, email),
          direccion = COALESCE(:direccion, direccion),
          activo = COALESCE(:activo, activo)
        WHERE id = :id
    """), data)
    db.commit()
    return db.execute(text("SELECT id, nombre, num_doc, telefono, email, direccion, activo FROM cliente WHERE id=:id"), {"id": cliente_id}).mappings().first()


@router.delete("/clientes/{cliente_id}")
def delete_cliente(cliente_id: int, db = Depends(db_dep)):
    try:
        res = db.execute(text("DELETE FROM cliente WHERE id=:id"), {"id": cliente_id})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se puede eliminar el cliente porque esta referenciado en otros registros")
    if res.rowcount == 0:
        raise HTTPException(404, "cliente no encontrado")
    return {"ok": True}


@router.put("/proveedores/{proveedor_id}")
def update_proveedor(proveedor_id: int, payload: dict, db = Depends(db_dep)):
    exists = db.execute(text("SELECT id FROM proveedor WHERE id=:id"), {"id": proveedor_id}).first()
    if not exists:
        raise HTTPException(404, "proveedor no encontrado")
    data = {
        "id": proveedor_id,
        "nombre": payload.get("nombre"),
        "num_doc": payload.get("num_doc"),
        "telefono": payload.get("telefono"),
        "email": payload.get("email"),
        "direccion": payload.get("direccion"),
        "activo": _normalize_bool(payload.get("activo")),
    }
    db.execute(text("""
        UPDATE proveedor SET
          nombre = COALESCE(:nombre, nombre),
          num_doc = COALESCE(:num_doc, num_doc),
          telefono = COALESCE(:telefono, telefono),
          email = COALESCE(:email, email),
          direccion = COALESCE(:direccion, direccion),
          activo = COALESCE(:activo, activo)
        WHERE id = :id
    """), data)
    db.commit()
    return db.execute(text("SELECT id, nombre, num_doc, telefono, email, direccion, activo FROM proveedor WHERE id=:id"), {"id": proveedor_id}).mappings().first()


@router.delete("/proveedores/{proveedor_id}")
def delete_proveedor(proveedor_id: int, db = Depends(db_dep)):
    try:
        res = db.execute(text("DELETE FROM proveedor WHERE id=:id"), {"id": proveedor_id})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se puede eliminar el proveedor porque esta referenciado en otros registros")
    if res.rowcount == 0:
        raise HTTPException(404, "proveedor no encontrado")
    return {"ok": True}


@router.put("/empleados/{empleado_id}")
def update_empleado(empleado_id: int, payload: dict, db = Depends(db_dep)):
    exists = db.execute(text("SELECT id FROM empleado WHERE id=:id"), {"id": empleado_id}).first()
    if not exists:
        raise HTTPException(404, "empleado no encontrado")
    data = {
        "id": empleado_id,
        "nombre": payload.get("nombre"),
        "num_doc": payload.get("num_doc"),
        "telefono": payload.get("telefono"),
        "email": payload.get("email"),
        "direccion": payload.get("direccion"),
        "tarifa_hora_crc": payload.get("tarifa_hora_crc"),
        "activo": _normalize_bool(payload.get("activo")),
    }
    db.execute(text("""
        UPDATE empleado SET
          nombre = COALESCE(:nombre, nombre),
          num_doc = COALESCE(:num_doc, num_doc),
          telefono = COALESCE(:telefono, telefono),
          email = COALESCE(:email, email),
          direccion = COALESCE(:direccion, direccion),
          tarifa_hora_crc = COALESCE(:tarifa_hora_crc, tarifa_hora_crc),
          activo = COALESCE(:activo, activo)
        WHERE id = :id
    """), data)
    db.commit()
    return db.execute(text("SELECT id, nombre, num_doc, telefono, email, direccion, tarifa_hora_crc, activo FROM empleado WHERE id=:id"), {"id": empleado_id}).mappings().first()


@router.delete("/empleados/{empleado_id}")
def delete_empleado(empleado_id: int, db = Depends(db_dep)):
    try:
        res = db.execute(text("DELETE FROM empleado WHERE id=:id"), {"id": empleado_id})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se puede eliminar el empleado porque esta referenciado en otros registros")
    if res.rowcount == 0:
        raise HTTPException(404, "empleado no encontrado")
    return {"ok": True}

