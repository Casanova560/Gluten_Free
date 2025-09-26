from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.get("/")
def list_rutas(db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT id,nombre,descripcion,dia_semana,activo
        FROM ruta ORDER BY nombre
    """))
    return [dict(r) for r in rows.mappings()]

@router.post("/")
def create_ruta(payload: dict, db: Session = Depends(db_dep)):
    q = text("""
        INSERT INTO ruta (nombre,descripcion,dia_semana,activo)
        VALUES (:nombre,:descripcion,:dia_semana, COALESCE(:activo,1))
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}

@router.get("/{ruta_id}/clientes")
def ruta_clientes(ruta_id: int, db: Session = Depends(db_dep)):
    rows = db.execute(text("""
        SELECT re.id, re.cliente_id, c.nombre AS cliente_nombre, re.orden, re.ventana_horaria
        FROM ruta_entrega re JOIN cliente c ON c.id = re.cliente_id
        WHERE re.ruta_id = :rid
        ORDER BY re.orden
    """), {"rid": ruta_id})
    return [dict(r) for r in rows.mappings()]

@router.post("/{ruta_id}/clientes")
def add_ruta_cliente(ruta_id: int, payload: dict, db: Session = Depends(db_dep)):
    payload = {**payload, "ruta_id": ruta_id}
    q = text("""
        INSERT INTO ruta_entrega (ruta_id,cliente_id,orden,ventana_horaria,nota)
        VALUES (:ruta_id,:cliente_id,:orden,:ventana_horaria,:nota)
    """)
    db.execute(q, payload); db.commit()
    return {"id": db.execute(text("SELECT LAST_INSERT_ID()")).scalar()}
