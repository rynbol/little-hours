# Stage 1 validation

The comparison base is `d447e4296ebbb4005609e7e576e780759895658b`, the requested `origin/codex/botw-look` fork. Browser evidence lives outside Git in `wilds-assets/progress-shots/wilds-three-codex/`. No competing submission was inspected.

## Gates

714 tests pass. Guard reports 358 files and no problems. Room verification and the production build pass. All 25 non-Forest browser flows pass across the initial run and clean reruns; the final Forest flow passes 26/26 checks. The initial run overlapped source reloads and heap inspection and had four failures; all four passed clean reruns without weakening checks.

Evidence: `2026-10-03T06-58-51-run` and `2026-10-03T07-13-24-run`.

## Room and island

Four-round Metal browser measurements compare the same views and rendering resolution. GPU differences are within the baseline spread; the lower CPU samples are observations, not an attributed optimization.

| Measurement | Room before | Room after | Island before | Island after |
|---|---:|---:|---:|---:|
| Idle CPU, ms/s | 185.3 | 117.2 | 47.6 | 37.2 |
| RAF fps | 59.8 | 59.8 | 59.8 | 59.8 |
| p95 frame gap, ms | 16.7 | 16.7 | 16.8 | 16.8 |
| GPU time, ms | 4.00 | 4.35 | 2.75 | 2.90 |
| Draw calls | 158 | 158 | 40 | 40 |
| Triangles | 370,984 | 370,984 | 543,818 | 543,818 |

Evidence: `baseline-room-perf.json`, `baseline-house-perf.json`, `2026-10-03T07-17-26-perf`, and `2026-10-03T07-18-47-perf`. Both views report zero browser errors.

The initial app bundle shrinks; the three.js slice is a separate lazy import. The real-input network check sees no three.js or Wilds module before Forest entry.

| Initial asset | Before, bytes | After, bytes | Before, gzip bytes | After, gzip bytes |
|---|---:|---:|---:|---:|
| Main JavaScript | 4,075,732 | 4,042,000 | 1,653,487 | 1,645,029 |
| Main CSS | 182,028 | 179,240 | 36,966 | 36,476 |

Both builds use Node's same gzip defaults. Evidence: `baseline-build.json` and `stage1-build.json`.

## Lifecycle and input fixes

A 20-visit heap run ends below its starting heap: 234.9 → 234.3 → 233.4 MiB. Babylon object counts remain constant. No discarded Wilds canvases or WebGL contexts remain at any measurement. Each disposed three.js renderer reports zero geometries, textures and programs, and a lost context. These are allocation and reachability checks, not a direct physical VRAM measurement.

Evidence: `2026-10-03T07-20-40-heap/this.json`.

Earlier failing runs exposed a shared lighting texture retaining renderer contexts. Disposal now includes the actual textures bound to shader uniforms. A final input run exposed a press and drag arriving within one frame: cancellation now takes precedence over that press. The regression test also verifies normal movement and the next click.

An instrumented run measured 29.6 fps after inspector object queries. An isolated play measurement without those queries reached 59.8 fps, with a worst frame of 16.8 ms and none over 20 ms. The combined flow now measures play before retained-object queries.

The original heap sampler waited 150 ms after collection while the island rendered; the recorded readings show up to 1.53 MB of fresh allocation during that wait. The Wilds sampler now reads immediately after its final collection and records every intermediate reading. A brief lifecycle-freeze experiment was discarded because it changed page visibility. Three warmups still showed rising heap usage. A fixed ten warmups reaches a plateau, followed by the required five measured visits; the baseline is exactly the last warmup sample, with the original 1 MiB limit unchanged.

The first corrected memory run (`2026-10-03T07-46-23-run`) records 242,072,896 → 242,078,128 bytes after five visits: growth of 5,232 bytes. All ten warmup samples and five measured samples are saved, with no discarded Wilds objects or GPU allocations after each exit. Its only failed assertion read movement after key-up; the player had run 19.88 m and was already idle. The sampler now reads while W remains held and releases the key in `finally`.

## Visual review

All four requested mood stills were inspected. Stage 1 deliberately uses the required capsule and training shapes. The final roll image fixes the visible gap at ground contact and preserves blade length. A fresh blind picture judge preferred the new image and passed all five grounding/legibility checks; this is evidence about that pose, not proof of final valley quality or control feel.

Evidence: `judge-roll-1/`, `2026-10-03T07-05-43-shot/wilds-roll-this.jpg`, and `2026-10-03T07-01-24-shot/wilds-this.jpg`.

## Final checkpoint

The final run (`2026-10-03T07-48-49-run`) passes all 26 Forest checks. Its five-second movement sample records 300 frames: 60 fps, p95 and maximum 16.8 ms, none over 20 ms. There are no browser errors. All movement, attack, camera, pause, entry and disposal assertions pass.

After ten fixed warmups, the five measured exits record 242,094,936 → 242,057,228 → 242,105,436 → 242,065,048 → 242,101,796 → 242,095,632 bytes: net growth of 696 bytes against the unchanged 1 MiB limit. Every disposal reports zero GPU allocations and context loss. Every retained-object inventory reports zero Wilds canvases and contexts. Babylon object counts and the saved game remain unchanged.

The owner playtest gates Stage 2.
