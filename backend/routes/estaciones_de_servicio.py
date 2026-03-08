from fastapi import APIRouter, HTTPException, Query
import sqlite3
import os

router = APIRouter()
DB_PATH = "data/surtidores.db"

def get_db_connection() -> Connection:
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="Base de datos no encontrada")
    
    conn: Connection = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@router.get("/precios-actuales")
async def obtener_precios_hoy(localidad: str = Query(None)) -> Any:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM precios_hoy"
    params: list[str] = []
    
    if localidad:
        query += " WHERE localidad = ?"
        params.append(localidad.upper())
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

@router.get("/precios-historicos")
async def obtener_historico(localidad: str = Query(None), bandera: str = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM precios_historicos WHERE 1=1"
    params: list[str] = []
    
    if localidad:
        query += " AND localidad = ?"
        params.append(localidad.upper())
    if bandera:
        query += " AND bandera = ?"
        params.append(bandera)
        
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]