import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from forestguard.server import serve  # noqa: E402


def web_root(explicit):
    """The app to serve: the built React bundle when it exists, otherwise webapp."""
    if explicit:
        return explicit
    dist = os.path.join(ROOT, "frontend", "dist")
    if os.path.isfile(os.path.join(dist, "index.html")):
        return dist
    return os.path.join(ROOT, "webapp")


def main():
    parser = argparse.ArgumentParser(description="Serve Vanadristi with real Earth Engine runs")
    parser.add_argument("--project", default=os.environ.get("EARTHENGINE_PROJECT"),
                        help="Activated Google Cloud project ID (or EARTHENGINE_PROJECT)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8777)
    parser.add_argument("--web-root", default=None,
                        help="serve this app instead of the built React bundle")
    parser.add_argument("--model-report",
                        default=os.path.join(ROOT, "models", "model_report.json"),
                        help="trained model report the model page reads")
    args = parser.parse_args()

    pipeline = None
    if args.project:
        from forestguard.realrun import RealPipeline
        try:
            pipeline = RealPipeline(args.project)
        except Exception as exc:
            print(f"Earth Engine initialization failed: {type(exc).__name__}: {str(exc)[:500]}")
            print("Real runs will remain disabled; the app will not substitute simulation data.")
    else:
        print("No Earth Engine project configured. Real runs are disabled.")
        print("After activation, restart with --project YOUR_PROJECT_ID.")

    root = web_root(args.web_root)
    print(f"Serving {os.path.relpath(root, ROOT)}")
    print(f"Model report: {args.model_report}"
          f"{' (none on disk yet)' if not os.path.isfile(args.model_report) else ''}")
    serve(root, pipeline, args.host, args.port, args.model_report)


if __name__ == "__main__":
    main()
