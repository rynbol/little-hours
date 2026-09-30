import importlib, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
shot = next((a.split('=', 1)[1] for a in args if a.startswith('--preview=')), None)
names = [a for a in args if not a.startswith('--')] or sorted(f[:-3].replace('_', '-') for f in os.listdir(os.path.dirname(os.path.abspath(__file__))) if f.endswith('.py') and f not in ('kit.py', 'run.py'))
for name in names:
    kit.reset()
    model = importlib.import_module(name.replace('-', '_'))
    if not hasattr(model, 'build'):
        continue
    kit.export(name, model.build(), getattr(model, 'AO', 0.7))
    if shot:
        kit.preview(os.path.join(shot, name + '.png'), getattr(model, 'EYE', (0.35, 0.45, 1.0)))
