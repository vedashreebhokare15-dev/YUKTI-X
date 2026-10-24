import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer

from forestguard import config
from forestguard.server import make_handler, make_server


class FakePipeline:
    def __init__(self):
        self.last_request = None

    def run(self, request):
        self.last_request = request
        return {"mode": "real", "run_id": "run-1", "layers": {}, "cells": []}

    def inspect(self, run_id, lon, lat):
        return {"mode": "real", "run_id": run_id, "lon": lon, "lat": lat,
                "label": "insufficient_evidence"}


class SlowPipeline:
    """A run that takes two seconds, the way a real Earth Engine request does."""

    def run(self, request):
        time.sleep(2)
        return {"mode": "real", "run_id": "slow-1", "layers": {}, "cells": []}


class TestServingStaysResponsive(unittest.TestCase):
    """A run must not freeze the rest of the app.

    A real run is a minutes-long request. Served one at a time, the browser cannot
    even load the page that is waiting for it, so the app looks dead while it works.
    """

    def setUp(self):
        self.root = tempfile.TemporaryDirectory()
        self.server = make_server("127.0.0.1", 0, self.root.name, SlowPipeline())
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.root.cleanup()

    def test_health_answers_while_a_run_is_still_working(self):
        running = threading.Thread(
            target=lambda: urllib.request.urlopen(
                urllib.request.Request(
                    f"{self.url}/api/run", data=b"{}",
                    headers={"Content-Type": "application/json"}, method="POST",
                ), timeout=30,
            ).read()
        )
        running.start()
        try:
            with urllib.request.urlopen(f"{self.url}/api/health", timeout=1.5) as response:
                self.assertEqual(response.status, 200)
        finally:
            running.join()


class TestServer(unittest.TestCase):
    def setUp(self):
        self.pipeline = FakePipeline()
        self.root = tempfile.TemporaryDirectory()
        self.server = make_server("127.0.0.1", 0, self.root.name, self.pipeline)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.root.cleanup()

    def request(self, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.url + path, data=data,
            headers={"Content-Type": "application/json"},
            method="GET" if payload is None else "POST",
        )
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_health_reports_real_configuration_without_secrets(self):
        status, body = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"earth_engine_ready": True})

    def test_regions_are_reported_from_backend_config_not_invented(self):
        status, body = self.request("/api/regions")
        self.assertEqual(status, 200)
        keys = sorted(row["key"] for row in body["regions"])
        self.assertEqual(keys, ["held_out", "pilot", "pilot_slice"])
        pilot = next(row for row in body["regions"] if row["key"] == "pilot")
        self.assertEqual(pilot["name"], config.PILOT["name"])
        self.assertEqual(pilot["bounds"], [[21.20, 77.20], [21.40, 77.50]])
        self.assertEqual(pilot["defaults"]["before"], list(config.PILOT["before"]))
        # The app needs to know which region a request can actually finish, so the
        # answer is in the payload rather than something the frontend guesses.
        self.assertFalse(pilot["forcible"])
        self.assertTrue(next(row for row in body["regions"]
                             if row["key"] == "pilot_slice")["forcible"])
        self.assertNotIn("tile_url", json.dumps(body))

    def test_valid_run_uses_normalized_real_request(self):
        status, body = self.request("/api/run", {})
        self.assertEqual(status, 200)
        self.assertEqual(body["mode"], "real")
        self.assertEqual(self.pipeline.last_request["region"], "pilot")
        self.assertNotIn("SIMULATION", json.dumps(body))

    def test_invalid_run_is_a_client_error(self):
        status, body = self.request("/api/run", {"region": "anywhere"})
        self.assertEqual(status, 400)
        self.assertIn("region", body["error"])

    def test_inspection_rejects_out_of_range_coordinates(self):
        status, body = self.request("/api/inspect", {"run_id": "run-1", "lon": 500, "lat": 21})
        self.assertEqual(status, 400)
        self.assertIn("lon", body["error"])

    def test_missing_pipeline_never_falls_back_to_simulation(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.server = HTTPServer(("127.0.0.1", 0), make_handler(self.root.name, None))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"
        status, body = self.request("/api/run", {})
        self.assertEqual(status, 503)
        self.assertIn("--project", body["error"])
        self.assertNotIn("scenario", json.dumps(body))


class TestStaticServing(unittest.TestCase):
    def setUp(self):
        self.pipeline = FakePipeline()
        self.root = tempfile.TemporaryDirectory()
        with open(os.path.join(self.root.name, "index.html"), "w", encoding="utf-8") as handle:
            handle.write("<html><body>Vanadristi bundle</body></html>")
        self.server = HTTPServer(("127.0.0.1", 0), make_handler(self.root.name, self.pipeline))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.root.cleanup()

    def get(self, path):
        request = urllib.request.Request(self.url + path, method="GET")
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            return error.code, error.read().decode("utf-8")

    def test_a_client_side_route_serves_the_bundle(self):
        status, body = self.get("/live")
        self.assertEqual(status, 200)
        self.assertIn("Vanadristi bundle", body)

    def test_a_missing_asset_is_still_a_four_oh_four(self):
        status, _ = self.get("/nothing-here.css")
        self.assertEqual(status, 404)


class TestModelReportRoute(unittest.TestCase):
    """The trained model page reads a file, so it answers in milliseconds."""

    def setUp(self):
        self.pipeline = FakePipeline()
        self.root = tempfile.TemporaryDirectory()
        self.models = tempfile.TemporaryDirectory()
        self.report = os.path.join(self.models.name, "model_report.json")

    def tearDown(self):
        shutdown = getattr(self, "server", None)
        if shutdown is not None:
            shutdown.shutdown()
            shutdown.server_close()
            self.thread.join()
        self.root.cleanup()
        self.models.cleanup()

    def serve(self):
        handler = make_handler(self.root.name, self.pipeline, model_report=self.report)
        self.server = HTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def get(self, path):
        request = urllib.request.Request(self.url + path, method="GET")
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def write(self, report):
        with open(self.report, "w", encoding="utf-8") as handle:
            json.dump(report, handle)

    def test_a_trained_model_is_served_without_touching_earth_engine(self):
        self.serve()
        self.write({"metrics": {"scored": 242}, "caveats": ["not ground truth"]})
        status, body = self.get("/api/model")
        self.assertEqual(status, 200)
        self.assertEqual(body["metrics"]["scored"], 242)

    def test_no_report_is_a_refusal_that_names_the_script_that_writes_one(self):
        self.serve()
        status, body = self.get("/api/model")
        self.assertEqual(status, 404)
        self.assertIn("train_reference_model.py", body["error"])

    def test_a_report_replaced_on_disk_is_the_one_served_next_request(self):
        self.serve()
        self.write({"metrics": {"scored": 1}})
        self.get("/api/model")
        self.write({"metrics": {"scored": 2}})
        status, body = self.get("/api/model")
        self.assertEqual(status, 200)
        self.assertEqual(body["metrics"]["scored"], 2)


if __name__ == "__main__":
    unittest.main()
