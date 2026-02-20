"""
Test to ensure /competencies/windows is not mistakenly matched as /{competency_id}

This test addresses a routing conflict where GET /api/v1/competencies/windows
was being matched by the dynamic route /{competency_id} instead of the static
/windows/ endpoint, causing a 422 error trying to parse "windows" as an integer.
"""


class TestCompetenciesRouting:
    """Tests for competencies routing order"""

    def test_route_order_windows_before_competency_id(self):
        """
        The /competencies/windows/ route must appear before
        /competencies/{competency_id:int} in the router so that a request
        for /competencies/windows is routed to the static endpoint and not
        mistakenly treated as an integer ID lookup.
        """
        from app.api.v1.routers import competencies

        routes = [r for r in competencies.router.routes if hasattr(r, "path")]

        windows_index = None
        competency_id_index = None

        for i, route in enumerate(routes):
            if route.path == "/competencies/windows/":
                windows_index = i
                break

        for i, route in enumerate(routes):
            if (
                "/competencies/{competency_id" in route.path
                and "GET" in route.methods
                # Only direct-child routes: /competencies/{id}, not /competencies/{id}/...
                and route.path.count("/") == 2
            ):
                competency_id_index = i
                break

        assert windows_index is not None, "Could not find /competencies/windows/ route"
        assert (
            competency_id_index is not None
        ), "Could not find direct /competencies/{competency_id} route"

        assert windows_index < competency_id_index, (
            f"Route order incorrect: /windows/ is at index {windows_index}, "
            f"but /{{competency_id}} is at index {competency_id_index}. "
            "Static routes must come before dynamic routes."
        )

    def test_direct_windows_routes_before_competency_id(self):
        """
        All /competencies/windows/ and /competencies/windows/{id} routes
        (depth 2–3, not depth 4+) must precede /competencies/{competency_id:int}.
        These are the routes that could conflict with the int-capture.
        """
        from app.api.v1.routers import competencies

        routes = [r for r in competencies.router.routes if hasattr(r, "path")]

        competency_id_index = None
        for i, route in enumerate(routes):
            if (
                "/competencies/{competency_id" in route.path
                and "GET" in route.methods
                and route.path.count("/") == 2
            ):
                competency_id_index = i
                break

        assert competency_id_index is not None, "Could not find /{competency_id} route"

        # Only check shallow /windows routes (depth <= 3) for ordering
        for i, route in enumerate(routes):
            if "/competencies/windows" in route.path and route.path.count("/") <= 3:
                assert i < competency_id_index, (
                    f"Shallow windows route '{route.path}' at index {i} comes after "
                    f"/{{competency_id}} at index {competency_id_index}"
                )
