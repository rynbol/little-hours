import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('destination', type=Path)
parser.add_argument('--ffmpeg', required=True)
args = parser.parse_args()
args.destination.mkdir(parents=True, exist_ok=True)
sequence = json.loads((args.source / 'sequence.json').read_text())
combat = json.loads((args.source / 'combat.json').read_text())
frames = sequence['frames']
start = frames[0]['realEpochMs']
duration = (frames[-1]['realEpochMs'] - start) / 1000
selected = [min(frames, key=lambda f: abs(f['realEpochMs'] - start - second * 1000)) for second in range(int(duration) + 1)]
for offset in range(0, len(selected), 12):
    sheet = Image.new('RGB', (1440, 1360), '#202424')
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(selected[offset:offset + 12]):
        picture = Image.open(args.source / frame['file'])
        picture.thumbnail((480, 320))
        x, y = (index % 3) * 480, (index // 3) * 340
        sheet.paste(picture, (x, y))
        draw.text((x + 8, y + 322), f"{(frame['realEpochMs'] - start) / 1000:.2f}s", fill='white')
    sheet.save(args.destination / f'review-{offset // 12 + 1:02d}.jpg', quality=88)
if (args.source / 'playback.mp4').exists():
    subprocess.run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(args.source / 'playback.mp4'), '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', '-an', str(args.destination / 'playback.mp4')], check=True)
for sample in combat['samples']:
    sample.pop('events', None)
(args.destination / 'combat.json').write_text(json.dumps(combat, separators=(',', ':')) + '\n')
(args.destination / 'capture.json').write_text(json.dumps({key: value for key, value in sequence.items() if key != 'frames'}, indent=2) + '\n')
(args.destination / 'watch.html').write_text('<!doctype html><meta charset="utf-8"><title>Warden play capture</title><style>body{margin:0;background:#172120;color:#eee;font:16px system-ui}video{width:100%;max-height:95vh}</style><video controls src="playback.mp4"></video>')
print(json.dumps({'seconds': round(duration, 2), 'frames': len(frames), 'style': combat.get('style', 'balanced'), 'bossHealth': combat['end']['combat']['boss']['health'], 'deaths': sum(event['type'] == 'player-defeated' for event in combat['events']), 'reviewPages': (len(selected) + 11) // 12}))
