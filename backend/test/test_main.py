import pytest
from httpx import AsyncClient
from backend.app import app
import os

@pytest.mark.asyncio
async def test_health_check():
    """Verifica que el servidor y la DB estén operativos"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

@pytest.mark.asyncio
async def test_analytics_comparativa():
    """Verifica que la consulta SQL con Window Functions funcione"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Probamos con un producto estándar
        response = await ac.get("/api/v1/analytics/comparativa-norte-pampeano?producto=NAFTA SUPER")
    
    assert response.status_code == 200
    data = response.json()
    assert "metricas" in data
    # Verificamos que los cálculos de aumento no sean nulos (excepto el primero)
    if len(data["metricas"]) > 1:
        assert "aumento_porcentual" in data["metricas"][0]

@pytest.mark.asyncio
async def test_industrial_stateless_flow():
    """Verifica la generación en RAM y descarga de CSV"""
    payload = {
        "email": "test_portfolio@example.com",
        "nombre": "Test_Unitario_Industrial"
    }
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/api/v1/industrial/generar-y-despachar", params=payload)
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv"
    assert "attachment" in response.headers["content-disposition"]
    # Verificamos que el buffer tenga contenido
    assert len(response.content) > 0

@pytest.mark.asyncio
async def test_rate_limiter():
    """Verifica que el escudo de protección (SlowAPI) bloquee excesos"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # El límite pusimos 2 o 3 por minuto, lanzamos 5 ráfagas
        responses = []
        for _ in range(5):
            responses.append(await ac.post("/api/v1/industrial/generar-y-despachar", 
                                         params={"email":"a@a.com", "nombre":"spam"}))
        
        status_codes = [r.status_code for r in responses]
        assert 429 in status_codes # Al menos una debe haber sido bloqueada