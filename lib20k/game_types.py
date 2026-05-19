#
# 20,000 Light Years Into Space
# This game is licensed under GPL v2, and copyright (C) Jack Whitham 2006-21.
#

import pygame
import typing

from typing import List, Dict, Tuple, Union, Optional
from .primitives import MenuCommand

# pygame.Surface / pygame.Rect may not be available at import time in pygbag WASM.
# These are only used as type annotations so 'object' is safe as a fallback.
try:
    SurfaceType = pygame.Surface
except AttributeError:
    SurfaceType = object  # type: ignore[assignment,misc]
Colour = Tuple[int, int, int]
Colour4 = Tuple[int, int, int, int]
BarMeterStatTuple = Tuple[int, Colour, int, Colour]
StatTuple = Tuple[Optional[Colour], Optional[int], Union[BarMeterStatTuple, str]]
SurfacePosition = Tuple[int, int]
FloatSurfacePosition = Tuple[float, float]
GridPosition = Tuple[int, int]
FloatGridPosition = Tuple[float, float]
try:
    RectType = pygame.Rect
except AttributeError:
    RectType = object  # type: ignore[assignment,misc]
UpdateAreaMethod = typing.Callable[[RectType], None]
MenuItem = Tuple[Optional[MenuCommand], Optional[str], List[int]]
ClockType = typing.Any
ControlRectType = Tuple[MenuCommand, RectType]
NextParticleType = Tuple[FloatSurfacePosition, Colour4]
FloatGridLine = Tuple[FloatGridPosition, FloatGridPosition]
GridLine = Tuple[GridPosition, GridPosition]
VersionType = Tuple[int, int, int]

