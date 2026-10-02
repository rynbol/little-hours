from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from avatar import build_avatar
from style_avatar import build_style_avatar
from style_creatures import build_style_creatures

build_avatar()
build_style_avatar()
build_style_creatures()
