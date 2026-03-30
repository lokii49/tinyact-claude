"""
Lightweight HTTP server that wraps notification_agent.py for Cloud Run.
Accepts Pub/Sub push messages (from Cloud Scheduler) and manual POST triggers.
"""

import os
import json
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from notification_agent import run_agent


class AgentHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle Pub/Sub push or manual trigger."""
        try:
            run_agent()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
        except Exception as e:
            traceback.print_exc()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())

    def do_GET(self):
        """Health check."""
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"TinyAct Notification Agent - healthy")


def main():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), AgentHandler)
    print(f"[Agent Server] Listening on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
