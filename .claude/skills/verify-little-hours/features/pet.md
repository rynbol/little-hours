# Pet

The room's pet: a cat, or Mochi the dog. The sleeping cat breathes slowly and moves its tail tip. Tapping the pet sends up three hearts one after another, with no words. The pet still makes small sounds (a cat "Mrrp!", a dog "Wuff!") in a bubble when it is carried, says hello, or plays with the companion.

- Path: tap the pet in the room (hook target `screenPoint('pet')`, which hit-tests the pet's real tap area). `#pet-button` opens the pet panel to switch cat and dog; `#pet-now` and `#pet-company` name it.
- Hearts: `room.diagnostics().petModel.hearts` are the three heart meshes; the flow checks they appear one at a time.
- Flow: `lh run pet`.
- What breaks: the tap area drifting away from the model (the bounding-box centre of the sleeping cat misses it by 10–40 px); a speech bubble showing on a tap; all hearts appearing at once; the choice lost after reload; motion that ignores reduced motion.
