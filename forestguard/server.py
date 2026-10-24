import json
import os
from http.server import SimpleHTTPRequestHandler
from urllib.parse import unquote, urlparse

from . import modelreport, runrequest

MAX_BODY_BYTES = 16_384


def makes_a_real_file(web_root, path) -> bool:
    """True when a request maps to a file inside the web root."""
    root = os.path.abspath(web_root)
    relative = unquote(urlparse(path).path).lstrip("/")
    if not relative:
        return os.path.isfile(os.path.join(root, "index.html"))
    target = os.path.normpath(os.path.join(root, relative))
    if target != root and not target.startswith(root + os.sep):
        return False
    return os.path.isfile(target)


def make_handler(web_root, pipeline, model_report=None):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=web_root, **kwargs)

        def _json(self, status, body):
            payload = json.dumps(body, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

        def _body(self):
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_BODY_BYTES:
                raise ValueError("request body is too large")
            try:
                return json.loads(self.rfile.read(length) or b"{}")
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError("request body must be valid JSON") from exc

        def do_GET(self):
            if self.path == "/api/health":
                self._json(200, {"earth_engine_ready": pipeline is not None})
                return
            if self.path == "/api/regions":
                self._json(200, {"regions": runrequest.regions_metadata()})
                return
            if self.path == "/api/model":
                # Read from disk on every request: retraining replaces the report
                # without a restart, and answering costs no Earth Engine call.
                try:
                    report = modelreport.load_report(model_report)
                except (OSError, ValueError) as exc:
                    self._json(500, {"error": f"model report is unreadable: {exc}"})
                    return
                if report is None:
                    self._json(404, {
                        "error": "No trained model report exists yet. Run "
                                 "scripts/train_reference_model.py with --report-out "
                                 "to train one and score it on a held-out region.",
                    })
                    return
                self._json(200, report)
                return
            if self.path.startswith("/api/"):
                self._json(404, {"error": "unknown API endpoint"})
                return
            if not makes_a_real_file(self.directory, self.path):
                # React Router owns paths like /live, and refreshing one has to load
                # the bundle. Only extension-less paths fall back, so a missing asset
                # still reports 404 instead of quietly returning HTML.
                if not os.path.splitext(urlparse(self.path).path)[1]:
                    self.path = "/index.html"
            super().do_GET()

        def do_POST(self):
            try:
                body = self._body()
                if self.path == "/api/run":
                    if pipeline is None:
                        self._json(503, {
                            "error": "Earth Engine is not configured. Restart the local "
                                     "server with --project YOUR_PROJECT_ID after activation."
                        })
                        return
                    self._json(200, pipeline.run(runrequest.normalize_request(body)))
                    return
                if self.path == "/api/inspect":
                    if pipeline is None:
                        self._json(503, {"error": "Earth Engine is not configured"})
                        return
                    run_id = body.get("run_id")
                    lon, lat = body.get("lon"), body.get("lat")
                    if not isinstance(run_id, str) or not run_id:
                        raise ValueError("run_id is required")
                    if isinstance(lon, bool) or not isinstance(lon, (int, float)) or not -180 <= lon <= 180:
                        raise ValueError("lon must be between -180 and 180")
                    if isinstance(lat, bool) or not isinstance(lat, (int, float)) or not -90 <= lat <= 90:
                        raise ValueError("lat must be between -90 and 90")
                    self._json(200, pipeline.inspect(run_id, lon, lat))
                    return
                self._json(404, {"error": "unknown API endpoint"})
            except ValueError as exc:
                self._json(400, {"error": str(exc)})
            except LookupError as exc:
                self._json(422, {"error": str(exc)})
            except KeyError:
                self._json(404, {"error": "run not found"})
            except Exception as exc:
                self._json(500, {"error": f"Earth Engine request failed: {str(exc)[:500]}"})

    return Handler


def make_server(host, port, web_root, pipeline, model_report=None):
    """A server that keeps answering while a run is in flight.

    A real run holds one request open for minutes. Served one at a time, the page
    that started the run cannot even load its own bundle or its region list, so the
    app looks broken exactly while it is working.
    """
    from http.server import ThreadingHTTPServer

    return ThreadingHTTPServer((host, port), make_handler(web_root, pipeline, model_report))


def serve(web_root, pipeline, host="127.0.0.1", port=8777, model_report=None):
    server = make_server(host, port, web_root, pipeline, model_report)
    print(f"Vanadristi: http://{host}:{port}/index.html")
    print(f"Earth Engine: {'ready' if pipeline is not None else 'not configured (real runs disabled)'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
