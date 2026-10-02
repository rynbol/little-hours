from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from avatar import build_avatar

build_avatar()
