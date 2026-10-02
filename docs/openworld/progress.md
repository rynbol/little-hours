## current step

Goal 3 combat audit. The current owner rules supersede the old combined rebuild plan. Work is restricted to combat, input/HUD/scene integration, the lh harness and the explicitly requested evidence/logs. No builder subagents, Docker, PRs or changes to look-agent files. pstack's reproduction, root-cause and verification guidance is applied locally.

## what is verified and how

`lh doctor` passed on the Metal GPU. The new `lh run wilds-combat` recorded a real-time, real-input 22.3 second entry-to-victory fight and passed six mechanical checks. Capture frames across the whole run were reviewed; visual acceptance failed. `combat-bugs.md` contains reproductions. Pre-existing dirty files were preserved, with a patch snapshot in ignored lh output. No owner bug list or chosen-character file was present.

## what remains

Reproduce additional play styles; write failing tests before each rule fix; consolidate attack specifications; add hit-stop and the required combatAction integration; rerun recordings, all gates and comparative fight performance. Commit/push each coherent step to codex/wilds. Ten consecutively clean visual fights remain **0 / 10**. Four generated reference images were reviewed; they remain an unapproved guess, and their earlier Ranger choice is superseded by the current CHOSEN.md rule.

## what looks or plays wrong in your own judgement

The character slides in one pose, never visibly swings or rolls, and the companion and Warden remain rigid. Sword hits pass through a standing stone; pet damage arrives before contact. Lock-on can put the stone between the camera and the fight. There is no hit-stop. The baseline wins numerically but does not feel like a working fight. Animation and camera repairs are open handoffs because their files are outside Goal 3.
