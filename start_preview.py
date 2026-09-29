#!/usr/bin/env python3
"""Simple local preview server for the Meta-T web project.

Run this from the project folder and it will start a local server at:
http://localhost:8000
The browser will automatically open to the game preview.
"""

import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)


if __name__ == "__main__":
    url = f"http://localhost:{PORT}/"
    print(f"Starting preview server at {url}")

    try:
        with ThreadingHTTPServer(("127.0.0.1", PORT), PreviewHandler) as httpd:
            webbrowser.open(url)
            print("Press Ctrl+C to stop the preview server.")
            httpd.serve_forever()
    except OSError as exc:
        print(f"Could not start preview on port {PORT}: {exc}")
        print("Try a different port by editing PORT in this file.")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nPreview server stopped.")
