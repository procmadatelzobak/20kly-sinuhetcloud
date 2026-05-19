#!/usr/bin/env python3
#
# 20ly_vajbcloding - web port of 20,000 Light Years Into Space
# Original game: (C) Jack Whitham 2006-21, GPL v2
# Web wrapper: (C) sinuhetcloud 2026, GPL v2
#
# Pygbag entry point — async main() required for browser/Pyodide execution
#

import asyncio
import sys
import os

# Ensure lib20k and data are found relative to this file
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

os.environ.setdefault("LIGHTYEARS_DIR", _HERE)


async def main():
    # In pygbag, gui_divider=2 splits screen 50/50 between terminal and canvas.
    # Set to 1 so the game canvas gets the full window. Must be done before
    # pygame display init so the canvas is sized correctly.
    try:
        import platform as _plat
        _plat.window.config.gui_divider = 1
        _plat.window.window_resize()
    except Exception:
        pass  # not in pygbag/WASM context

    # Must init pygame BEFORE importing lib20k — WASM pygame constants are
    # only available after init(), and lib20k modules use them at module level.
    import pygame
    pygame.init()
    pygame.font.init()

    from lib20k import Main, Events
    await Main(data_dir=os.path.join(_HERE, "data"), args=[], event=Events())


asyncio.run(main())
