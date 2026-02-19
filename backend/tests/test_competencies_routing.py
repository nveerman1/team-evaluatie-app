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
        Test that the /windows/ routes are registered before /{competency_id}
        in the router to ensure correct routing priority.
        """
        from app.api.v1.routers import competencies

        # Get all routes from the router
        routes = [r for r in competencies.router.routes if hasattr(r, "path")]

        # Find indices of relevant routes
        windows_index = None
        competency_id_index = None

        for i, route in enumerate(routes):
            if route.path == "/competencies/windows/":
                windows_index = i
            elif (
                route.path == "/competencies/{competency_id}" and "GET" in route.methods
            ):
                competency_id_index = i

        assert windows_index is not None, "Could not find /windows/ route"
        assert competency_id_index is not None, "Could not find /{competency_id} route"

        # The critical assertion: /windows/ must come before /{competency_id}
        assert windows_index < competency_id_index, (
            f"Route order incorrect: /windows/ is at index {windows_index}, "
            f"but /{{competency_id}} is at index {competency_id_index}. "
            f"Static routes must come before dynamic routes to prevent matching 'windows' as an ID."
        )

    def test_all_windows_routes_before_competency_id(self):
        """
        Test that ALL /windows/* routes are registered before /{competency_id}.
        """
        from app.api.v1.routers import competencies

        routes = [r for r in competencies.router.routes if hasattr(r, "path")]

        # Find the index of /{competency_id}
        competency_id_index = None
        for i, route in enumerate(routes):
            if route.path == "/competencies/{competency_id}" and "GET" in route.methods:
                competency_id_index = i
                break

        assert competency_id_index is not None, "Could not find /{competency_id} route"

        # Check that all basic /windows/ routes come before it
        windows_paths = [
            "/competencies/windows/",
            "/competencies/windows/{window_id}",
        ]

        for windows_path in windows_paths:
            for i, route in enumerate(routes):
                if route.path == windows_path:
                    assert i < competency_id_index, (
                        f"Route {windows_path} is at index {i}, "
                        f"but /{{competency_id}} is at index {competency_id_index}. "
                        f"All /windows/* routes must come before dynamic /{{competency_id}}."
                    )
