from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

# CLIENTES
@router.get("/clientes")
def list_clientes(db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id,nombre,num_doc,telefono,email,direccion,activo
        FROM cliente ORDER BY nombre
    """))
    return [dict(r) for r in rows.mappings()]

@router.post("/clientes")
def create_cliente(payload: dict, db: Session = Depends(db_dep)):
    q = text("""
        INSERT INTO cliente (nombre,num_doc,telefono,email,direccion,activo)
        VALUES (:nombre,:num_doc,:telefono,:email,:direccion, COALESCE(:activo,1))
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

# PROVEEDORES
@router.get("/proveedores")
def list_proveedores(db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id,nombre,num_doc,telefono,email,direccion,activo
        FROM proveedor ORDER BY nombre
    """))
    return [dict(r) for r in rows.mappings()]

@router.post("/proveedores")
def create_proveedor(payload: dict, db: Session = Depends(db_dep)):
    q = text("""
        INSERT INTO proveedor (nombre,num_doc,telefono,email,direccion,activo)
        VALUES (:nombre,:num_doc,:telefono,:email,:direccion, COALESCE(:activo,1))
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

# EMPLEADOS
@router.get("/empleados")
def list_empleados(db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id,nombre,num_doc,telefono,email,direccion,activo
        FROM empleado ORDER BY nombre
    """))
    return [dict(r) for r in rows.mappings()]

@router.post("/empleados")
def create_empleado(payload: dict, db: Session = Depends(db_dep)):
    q = text("""
        INSERT INTO empleado (nombre,num_doc,telefono,email,direccion,activo)
        VALUES (:nombre,:num_doc,:telefono,:email,:direccion, COALESCE(:activo,1))
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}
