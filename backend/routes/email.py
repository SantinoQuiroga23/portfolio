import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import EmailStr
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()

HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
HEADERS = {"Authorization": f"Bearer {os.getenv('HF_TOKEN')}"}

def resumen_ia_gratis(datos):
    prompt = f"<s>[INST] Eres un analista industrial. Resume estos precios de combustible en La Pampa y da una conclusión breve: {str(datos)} [/INST]</s>"
    response = requests.post(HF_API_URL, headers=HEADERS, json={"inputs": prompt})
    if response.status_code == 200:
        return response.json()[0]['generated_text'].split("[/INST]")[-1].strip()
    return "Resumen temporalmente no disponible."

@router.post("/simular-y-enviar")
@limiter.limit("2/minute")
async def flujo_completo(request: Request, email: EmailStr, nombre: str):
    try:
        p_sucio, p_excel, datos_muestra = generar_flujo_industrial(nombre, 1000)     
        analisis = resumen_ia_gratis(datos_muestra)

        return {
            "status": "Procesado",
            "archivos": {"csv_sucio": p_sucio, "excel_master": p_excel},
            "analisis_ia": analisis,
            "nota": "El reporte Excel ha sido generado con formatos industriales."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))