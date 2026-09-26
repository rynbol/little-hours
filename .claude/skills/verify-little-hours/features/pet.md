# Pet

The room's pet: a cat, or Mochi the dog. The sleeping cat breathes slowly and moves its tail tip; tapping the pet shows a speech bubble.

- Path: tap the pet in the room (hook target `screenPoint('pet')`, which hit-tests the pet's real tap area). `#pet-button` opens the pet panel to switch cat and dog; `#pet-now` and `#pet-company` name it.
- Flow: `lh run pet`.
- What breaks: the tap area drifting away from the model (the bounding-box centre of the sleeping cat misses it by 10–40 px); the choice lost after reload; motion that ignores reduced motion.
