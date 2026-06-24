async def _new_html_dashboard(admin_client):
    r = await admin_client.post(
        "/api/dashboards",
        json={"name": "Versioned", "type": "static_html", "visibility": "restricted"},
    )
    return r.json()["id"]


async def _upload(admin_client, did, body: bytes):
    files = {"file": ("r.html", body, "text/html")}
    return await admin_client.post(f"/api/dashboards/{did}/upload", files=files)


async def test_upload_creates_versions(admin_client):
    did = await _new_html_dashboard(admin_client)
    await _upload(admin_client, did, b"<h1>v1</h1>")
    await _upload(admin_client, did, b"<h1>v2</h1>")

    r = await admin_client.get(f"/api/dashboards/{did}/versions")
    assert r.status_code == 200
    versions = r.json()
    assert [v["version_no"] for v in versions] == [2, 1]  # newest first
    assert versions[0]["is_current"] is True
    assert versions[1]["is_current"] is False


async def test_restore_previous_version(admin_client):
    did = await _new_html_dashboard(admin_client)
    await _upload(admin_client, did, b"<h1>ONE</h1>")
    await _upload(admin_client, did, b"<h1>TWO</h1>")

    versions = (await admin_client.get(f"/api/dashboards/{did}/versions")).json()
    v1 = next(v for v in versions if v["version_no"] == 1)

    rr = await admin_client.post(f"/api/dashboards/{did}/versions/{v1['id']}/restore")
    assert rr.status_code == 200

    # The served content is now v1 again.
    tok = (await admin_client.get(f"/api/dashboards/{did}/content-token")).json()
    page = await admin_client.get(tok["src"])
    assert b"ONE" in page.content
    assert b"TWO" not in page.content


async def test_pruned_to_ten(admin_client):
    did = await _new_html_dashboard(admin_client)
    for i in range(12):
        await _upload(admin_client, did, f"<h1>v{i}</h1>".encode())
    versions = (await admin_client.get(f"/api/dashboards/{did}/versions")).json()
    assert len(versions) == 10
    # The two oldest (1, 2) were pruned; newest is 12.
    assert versions[0]["version_no"] == 12
    assert min(v["version_no"] for v in versions) == 3
