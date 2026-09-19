# Build and explore the documentation

This exercise creates a local documentation site. You need the WPP checkout,
Python 3.12 or newer, and internet access to install the documentation tools.
It does not connect a Google account or run the planned application.

From the repository root, create an isolated environment and install the tools:

```sh
python3 -m venv .venv-docs
.venv-docs/bin/python -m pip install -r docs/requirements.txt
```

Build the HTML documentation with warnings treated as errors:

```sh
.venv-docs/bin/python -m sphinx -W --keep-going -b html docs docs/_build/html
```

The command should finish with `build succeeded`. Open
`docs/_build/html/index.html` in a browser, or serve it locally:

```sh
.venv-docs/bin/python -m http.server 8000 --bind 127.0.0.1 --directory docs/_build/html
```

Visit `http://127.0.0.1:8000`. Follow **Explanation** to learn the planned Google
Drive flow, then **Reference** to inspect its acceptance checklist. Stop the
server with Ctrl+C when finished.
