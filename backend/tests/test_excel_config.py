import io

from openpyxl import Workbook


def _xlsx() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Ventas"
    ws.append(["Mes", "Ingresos", "Gastos"])
    for r in [("Enero", 100, 60), ("Febrero", 150, 70)]:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


async def _excel_dashboard(admin_client):
    r = await admin_client.post(
        "/api/dashboards",
        json={"name": "Cfg Excel", "type": "excel", "visibility": "restricted"},
    )
    did = r.json()["id"]
    up = await admin_client.post(
        f"/api/dashboards/{did}/upload",
        files={"file": ("d.xlsx", _xlsx(), "application/octet-stream")},
    )
    assert up.status_code == 200, up.text
    return did


async def test_default_heuristic_chart(admin_client):
    did = await _excel_dashboard(admin_client)
    data = (await admin_client.get(f"/api/dashboards/{did}/data")).json()
    chart = data["sheets"][0]["chart"]
    assert chart["category"] == "Mes"
    assert chart["series"] == ["Ingresos", "Gastos"]  # both numeric cols
    assert chart["type"] == "bar"


async def test_config_overrides_chart(admin_client):
    did = await _excel_dashboard(admin_client)
    # Configure a line chart with only "Ingresos".
    patch = await admin_client.patch(
        f"/api/dashboards/{did}",
        json={
            "excel_config": {
                "sheet": "Ventas",
                "chart_type": "line",
                "category": "Mes",
                "series": ["Ingresos"],
            }
        },
    )
    assert patch.status_code == 200
    assert patch.json()["excel_config"]["chart_type"] == "line"

    data = (await admin_client.get(f"/api/dashboards/{did}/data")).json()
    chart = data["sheets"][0]["chart"]
    assert chart["type"] == "line"
    assert chart["series"] == ["Ingresos"]  # Gastos excluded by config


async def test_config_none_hides_chart(admin_client):
    did = await _excel_dashboard(admin_client)
    await admin_client.patch(
        f"/api/dashboards/{did}",
        json={
            "excel_config": {
                "sheet": "Ventas",
                "chart_type": "none",
                "category": "Mes",
                "series": [],
            }
        },
    )
    data = (await admin_client.get(f"/api/dashboards/{did}/data")).json()
    assert data["sheets"][0]["chart"] is None
