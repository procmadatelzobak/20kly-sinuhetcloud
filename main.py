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
    from lib20k import Main, Events
    await Main(data_dir=os.path.join(_HERE, "data"), args=[], event=Events())


asyncio.run(main())
