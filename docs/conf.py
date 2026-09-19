"""WPP feature documentation; build separately from research snapshots."""
project = "WitnessProtectionProgram"
author = "WitnessProtectionProgram contributors"
release = "Design / Google Drive beta planning"
extensions = ["myst_parser"]
source_suffix = {".md": "markdown", ".rst": "restructuredtext"}
root_doc = "index"
exclude_patterns = ["_build", "superpowers/**", "README.md"]
html_theme = "alabaster"
html_title = "WitnessProtectionProgram documentation"
myst_heading_anchors = 3
nitpicky = True
