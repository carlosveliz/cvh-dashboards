async def _folder(admin_client, name):
    r = await admin_client.post("/api/folders", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


async def _dashboard(admin_client, name, folder_id=None):
    r = await admin_client.post(
        "/api/dashboards",
        json={"name": name, "type": "static_html", "visibility": "restricted", "folder_id": folder_id},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_create_list_folder(admin_client):
    f = await _folder(admin_client, "Finanzas")
    assert f["name"] == "Finanzas"
    assert f["dashboard_count"] == 0  # empty folder allowed

    folders = (await admin_client.get("/api/folders")).json()
    assert any(x["id"] == f["id"] and x["name"] == "Finanzas" for x in folders)


async def test_duplicate_name_409(admin_client):
    await _folder(admin_client, "Dup")
    r = await admin_client.post("/api/folders", json={"name": "Dup"})
    assert r.status_code == 409


async def test_rename_folder(admin_client):
    f = await _folder(admin_client, "Antiguo")
    r = await admin_client.patch(f"/api/folders/{f['id']}", json={"name": "Nuevo"})
    assert r.status_code == 200
    assert r.json()["name"] == "Nuevo"


async def test_assign_and_count(admin_client):
    f = await _folder(admin_client, "Operaciones")
    await _dashboard(admin_client, "Dash 1", f["id"])
    await _dashboard(admin_client, "Dash 2", f["id"])
    folders = (await admin_client.get("/api/folders")).json()
    op = next(x for x in folders if x["id"] == f["id"])
    assert op["dashboard_count"] == 2

    # The dashboard list reports folder name + position for grouping.
    dashboards = (await admin_client.get("/api/dashboards")).json()
    d1 = next(x for x in dashboards if x["name"] == "Dash 1")
    assert d1["folder_id"] == f["id"]
    assert d1["folder_name"] == "Operaciones"


async def test_move_dashboard_between_folders(admin_client):
    a = await _folder(admin_client, "A")
    b = await _folder(admin_client, "B")
    d = await _dashboard(admin_client, "Movible", a["id"])
    # Move to B
    r = await admin_client.patch(f"/api/dashboards/{d['id']}", json={"folder_id": b["id"]})
    assert r.status_code == 200
    # Move to General (null)
    r2 = await admin_client.patch(f"/api/dashboards/{d['id']}", json={"folder_id": None})
    assert r2.status_code == 200
    dashboards = (await admin_client.get("/api/dashboards")).json()
    moved = next(x for x in dashboards if x["name"] == "Movible")
    assert moved["folder_id"] is None
    assert moved["folder_name"] is None


async def test_delete_folder_sends_dashboards_to_general(admin_client):
    f = await _folder(admin_client, "Temporal")
    d = await _dashboard(admin_client, "Huérfano", f["id"])
    r = await admin_client.delete(f"/api/folders/{f['id']}")
    assert r.status_code == 204
    # Folder gone, dashboard survives in General.
    folders = (await admin_client.get("/api/folders")).json()
    assert all(x["id"] != f["id"] for x in folders)
    dashboards = (await admin_client.get("/api/dashboards")).json()
    orphan = next(x for x in dashboards if x["name"] == "Huérfano")
    assert orphan["folder_id"] is None


async def test_reorder_folders(admin_client):
    f1 = await _folder(admin_client, "Uno")
    f2 = await _folder(admin_client, "Dos")
    f3 = await _folder(admin_client, "Tres")
    # Put them in reverse order.
    r = await admin_client.put("/api/folders/reorder", json={"ids": [f3["id"], f2["id"], f1["id"]]})
    assert r.status_code == 200
    ordered = r.json()
    names_in_order = [x["name"] for x in sorted(ordered, key=lambda x: x["position"])]
    assert names_in_order[:3] == ["Tres", "Dos", "Uno"]


async def test_folders_admin_only(client):
    assert (await client.get("/api/folders")).status_code == 401
