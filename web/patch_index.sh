#!/bin/bash
# Post-build patches to build/web/index.html
# These fix canvas sizing and disable the debug terminal in production.
set -e

INDEX="build/web/index.html"

# 1. Remove "vtx" from data-os to disable the xterm terminal pane.
#    With vtx enabled, gui_divider=2 splits screen 50/50 → game canvas is too small.
sed -i 's/data-os="vtx,snd,gui"/data-os="snd,gui"/' "$INDEX"

# 2. Set gui_divider=1 in the initial JS config so the game canvas gets the full window.
sed -i 's/gui_divider : 2,/gui_divider : 1,/' "$INDEX"

echo "patch_index.sh: patched $INDEX (vtx removed, gui_divider=1)"
