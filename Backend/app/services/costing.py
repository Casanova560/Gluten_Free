from sqlalchemy import text
from sqlalchemy.orm import Session

def receta_costos(db: Session, receta_id: int):
    # Usa vistas creadas: v_costo_receta_total y v_costo_receta_directo
    row = db.execute(text("""
        SELECT receta_id, receta_nombre, costo_directo_crc, costo_indirecto_asignado_crc, costo_total_crc
        FROM v_costo_receta_total
        WHERE receta_id = :rid
    """), {"rid": receta_id}).mappings().first()
    return dict(row) if row else {}
