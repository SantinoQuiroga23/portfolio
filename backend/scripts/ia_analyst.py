import requests
from config import settings

def analizar_datos_con_ia(muestra_datos: list) -> str:
    """
    Analiza datos con un enfoque conservador y técnico para un perfil industrial senior.
    Modelo: Llama 3.1 8B (vía Groq)
    """
    GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_token}",
        "Content-Type": "application/json"
    }

    prompt_sistema = (
        "Eres un Auditor Senior de Operaciones Industriales. "
        "Tu audiencia es personal directivo con amplia experiencia. "
        "Tu tono debe ser formal, extremadamente conservador y directo. "
        "REGLA CRÍTICA: No inventes datos. Si no hay una tendencia clara, limítate a los hechos. "
        "Evita adjetivos innecesarios y lenguaje entusiasta."
    )
    
    prompt_usuario = (
        f"Informe de situación - Datos crudos: {str(muestra_datos[:10])}\n\n"
        "Proporcione: \n"
        "1. Observación técnica del precio promedio.\n"
        "2. Identificación de valores atípicos (máximos/mínimos).\n"
        "3. Breve sugerencia de monitoreo basada estrictamente en estos valores."
    )

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario}
        ],
        "temperature": 0.1, 
        "max_tokens": 200,
        "top_p": 1
    }

    try:
        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=5)
        if response.status_code == 200:
            return response.json()['choices'][0]['message']['content'].strip()
        response.raise_for_status()

    except Exception:
        try:
            precios = [d.get('precio', 0) for d in muestra_datos if isinstance(d.get('precio'), (int, float))]
            if precios:
                return (
                    f"Reporte Técnico Local:\n"
                    f"- Valor Promedio: ${sum(precios)/len(precios):.2f}\n"
                    f"- Rango Detectado: ${min(precios):.2f} a ${max(precios):.2f}\n"
                    f"- Nota: Información basada en procesamiento algorítmico local."
                )
        except: pass
        return "Resumen no disponible. Por favor, remítase a los archivos adjuntos."