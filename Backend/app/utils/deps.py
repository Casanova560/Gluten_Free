from fastapi import Depends
from sqlalchemy.orm import Session
from ..db import get_db

def db_dep(db: Session = Depends(get_db)):
    return db
