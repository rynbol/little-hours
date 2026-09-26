# Doors and stairs

Doors in the room lead to the neighbouring rooms; the stair leads to the loft. Unbuilt neighbours show as locked.

- Path: click a door in the room canvas. Hook target: `screenPoint({ door: '<room id>' })`. The avatar walks to the door, then the room changes and `#room-title` updates.
- Flow: `lh run doors`.
- What breaks: a door that is covered by furniture and cannot be clicked; the walk and the travel both firing; an unbuilt door that travels instead of showing its price in `#toast`.
