from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..utils.deps import db_dep

router = APIRouter()

@router.get("/dashboard")
def dashboard(db: Session = Depends(db_dep)):
    ventas = [dict(r) for r in db.execute(text("""
        SELECT * FROM v_ventas_diarias ORDER BY fecha DESC LIMIT 30
    """)).mappings()]
    compras = [dict(r) for r in db.execute(text("""
        SELECT * FROM v_compras_diarias ORDER BY fecha DESC LIMIT 30
    """)).mappings()]
    margen  = [dict(r) for r in db.execute(text("""
        SELECT * FROM v_margen_directo_mes ORDER BY ym DESC LIMIT 12
    """)).mappings()]
    return {"ventas": ventas, "compras": compras, "margen": margen}

