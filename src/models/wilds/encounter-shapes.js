import { BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from '../../core/world-terrain.js';
import { ARENA, STONES, BOSS_ATTACKS } from '../../core/wilds/encounter.js';

function paint(color) {
  const material = new MeshStandardMaterial({ color, roughness: .9 });
  material.userData.wildsUniforms = [];
  material.onBeforeCompile = shader => {
    const captured = material.userData.wildsUniforms;
    captured.length = 0;
    captured.push(shader.uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float luminance = max(0.001, dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)));
      float bands = floor(luminance * 4.0) / 4.0 + smoothstep(0.28, 0.72, fract(luminance * 4.0)) / 4.0;
      outgoingLight *= mix(1.0, bands / luminance, 0.28);
      float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
      outgoingLight += diffuseColor.rgb * vec3(0.07, 0.085, 0.12) + rim * vec3(0.065, 0.074, 0.05);
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'wilds-paint-1';
  return material;
}

function ellipsoid(x, y, z, sx, sy, sz) {
  return new SphereGeometry(1, 10, 6).scale(sx, sy, sz).translate(x, y, z);
}

function branch(a, b, radius, tip = radius * .65) {
  const from = new Vector3(...a), to = new Vector3(...b), direction = to.clone().sub(from);
  const geometry = new CylinderGeometry(tip, radius, direction.length(), 7);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  geometry.applyQuaternion(rotation).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return geometry;
}

function joined(parts, material, parent) {
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

export function createEncounterShapes(scene) {
  const wood = paint('#766c50'), stone = paint('#9b9c86'), moss = paint('#637858'), amber = paint('#e3b96a'), ginger = paint('#c98b50'), cream = paint('#efd8ac'), dark = paint('#514d43');
  amber.emissive.set('#a86720');
  const boss = new Group(), torso = new Group(), neck = new Group(), head = new Group();
  torso.rotation.order = 'YXZ';
  boss.name = 'mossheart-blockout'; boss.add(torso); torso.add(neck); neck.add(head); scene.add(boss);
  joined([ellipsoid(0, 2.15, .1, .67, .79, 1.12), branch([0, 2.1, -.65], [0, 2.9, -1.02], .43, .3)], wood, torso);
  joined([ellipsoid(-.47, 2.36, -.37, .28, .43, .48), ellipsoid(.47, 2.36, -.37, .28, .43, .48), ellipsoid(0, 2.55, .57, .59, .25, .51)], stone, torso);
  neck.position.set(0, 2.66, -.94);
  joined([branch([0, -.15, 0], [0, .5, -.15], .32, .22)], wood, neck);
  head.position.set(0, .49, -.15);
  joined([ellipsoid(0, 0, -.17, .3, .35, .49), ellipsoid(0, -.15, -.55, .24, .2, .26), ellipsoid(-.37, .15, .02, .27, .1, .15), ellipsoid(.37, .15, .02, .27, .1, .15)], wood, head);
  joined([ellipsoid(-.27, .06, -.39, .035, .055, .055), ellipsoid(.27, .06, -.39, .035, .055, .055)], amber, head);
  const antlerParts = [], mossParts = [];
  for (const side of [-1, 1]) {
    const chain = [[side * .2, .25, .03], [side * .43, .65, .15], [side * .77, 1.04, .2], [side * 1.13, 1.32, .16]];
    for (let i = 0; i < chain.length - 1; i++) antlerParts.push(branch(chain[i], chain[i + 1], .1 - i * .02));
    antlerParts.push(branch(chain[1], [side * .43, 1.08, -.21], .07, .025), branch(chain[2], [side * .9, 1.51, .27], .055, .015), branch(chain[3], [side * 1.42, 1.35, -.08], .035, .01));
    mossParts.push(ellipsoid(side * .67, .97, .21, .2, .08, .13));
  }
  const antlers = joined(antlerParts, wood, head); antlers.name = 'stag-antlers'; joined(mossParts, moss, head);
  const heart = joined([ellipsoid(0, 0, 0, .27, .35, .13)], amber, torso); heart.name = 'exposed-heart'; heart.position.set(0, 2.22, -.87);
  const legs = new InstancedMesh(new CylinderGeometry(.12, .16, 1, 7), wood, 4), hooves = new InstancedMesh(new BoxGeometry(.25, .2, .32), dark, 4);
  legs.name = 'stag-legs'; hooves.name = 'stag-hooves'; legs.castShadow = true; hooves.castShadow = true; scene.add(legs, hooves);
  const stones = new InstancedMesh(new CylinderGeometry(.47, .68, 3, 7), stone, STONES.length);
  const stoneCaps = new InstancedMesh(new SphereGeometry(1, 7, 4), moss, STONES.length);
  stones.name = 'standing-stone-ring'; stones.castShadow = true; stones.receiveShadow = true; stoneCaps.castShadow = true; scene.add(stones, stoneCaps);
  const matrix = new Matrix4(), rotation = new Quaternion(), scale = new Vector3(), position = new Vector3();
  STONES.forEach((s, i) => {
    rotation.setFromAxisAngle(new Vector3(0, 1, 0), i * 1.72);
    position.set(s.x, heightAt(s.x, s.z) + s.height / 2, s.z); scale.set(1, s.height / 3, 1);
    stones.setMatrixAt(i, matrix.compose(position, rotation, scale));
    position.y = heightAt(s.x, s.z) + s.height - .12; scale.set(.51, .16, .51);
    stoneCaps.setMatrixAt(i, matrix.compose(position, rotation, scale));
  });
  const pet = new Group(), catBody = new Group(), catTail = new Group(); pet.name = 'ginger-partner-blockout'; pet.add(catBody); scene.add(pet);
  joined([ellipsoid(0, .35, 0, .21, .23, .4), ellipsoid(0, .48, -.35, .23, .23, .22), new CylinderGeometry(0, .115, .22, 3).rotateY(Math.PI / 6).translate(-.145, .71, -.33), new CylinderGeometry(0, .115, .22, 3).rotateY(-Math.PI / 6).translate(.145, .71, -.33)], ginger, catBody);
  joined([ellipsoid(0, .42, -.52, .13, .1, .05)], cream, catBody);
  joined([ellipsoid(0, .43, -.566, .035, .025, .018), ellipsoid(-.12, .52, -.53, .025, .04, .015), ellipsoid(.12, .52, -.53, .025, .04, .015)], dark, catBody);
  catTail.position.set(0, .4, .31); catBody.add(catTail);
  joined([branch([0, 0, 0], [.04, .26, .24], .055), branch([.04, .26, .24], [.09, .47, .2], .043)], ginger, catTail);
  const paws = new InstancedMesh(new CylinderGeometry(.065, .075, .25, 6), ginger, 4); paws.castShadow = true; scene.add(paws);
  const roots = new InstancedMesh(new CylinderGeometry(.025, .16, 1, 6), wood, 12); roots.name = 'erupting-roots'; roots.castShadow = true; roots.visible = false; scene.add(roots);
  const camp = new Group(); camp.name = 'restart-camp'; camp.position.set(ARENA.camp.x, heightAt(ARENA.camp.x, ARENA.camp.z), ARENA.camp.z); scene.add(camp);
  const hearth = new Group(); hearth.name = 'camp-hearth'; hearth.position.set(-1.4, heightAt(ARENA.camp.x - 1.4, ARENA.camp.z) - camp.position.y, 0); camp.add(hearth);
  joined([branch([-.5, .1, -.25], [.5, .1, .25], .09), branch([-.5, .12, .25], [.5, .12, -.25], .09)], wood, hearth);
  joined([ellipsoid(0, .3, 0, .15, .25, .15)], amber, hearth);
  joined([new BoxGeometry(.62, .08, 1.35).translate(1.1, .06, 0)], moss, camp);
  const shadowMaterial = new MeshBasicMaterial({ color: '#263e36', transparent: true, opacity: .18, depthWrite: false });
  const shadows = new InstancedMesh(new CircleGeometry(1, 24).rotateX(-Math.PI / 2), shadowMaterial, 2); scene.add(shadows);
  const telegraphMaterial = new MeshBasicMaterial({ color: '#e3ba77', transparent: true, opacity: .24, side: DoubleSide, depthWrite: false });
  const effectMaterial = new MeshBasicMaterial({ color: '#ffe0a1', transparent: true, opacity: .7, side: DoubleSide, depthWrite: false });
  const telegraphGeometry = new BufferGeometry(), effectGeometry = new BufferGeometry();
  const telegraphPositions = new Float32Array(96 * 18), effectPositions = new Float32Array(96 * 18);
  telegraphGeometry.setAttribute('position', new BufferAttribute(telegraphPositions, 3)); effectGeometry.setAttribute('position', new BufferAttribute(effectPositions, 3));
  const telegraph = new Mesh(telegraphGeometry, telegraphMaterial), effect = new Mesh(effectGeometry, effectMaterial);
  telegraph.name = 'attack-telegraph'; effect.name = 'attack-impact'; telegraph.frustumCulled = false; effect.frustumCulled = false; scene.add(telegraph, effect);
  const bossPosition = [ARENA.x, heightAt(ARENA.x, ARENA.z) + 2.3, ARENA.z], petPosition = [0, 0, 2];
  let vertices = 0, previousBossX = ARENA.x, previousBossZ = ARENA.z;
  function vertex(buffer, x, z, lift = .035) { buffer[vertices++] = x; buffer[vertices++] = heightAt(x, z) + lift; buffer[vertices++] = z; }
  function strip(buffer, ax, az, bx, bz, cx, cz, dx, dz) {
    vertex(buffer, ax, az); vertex(buffer, bx, bz); vertex(buffer, cx, cz); vertex(buffer, cx, cz); vertex(buffer, bx, bz); vertex(buffer, dx, dz);
  }
  function ribbon(geometry, buffer, x, z, heading, kind, radius, width) {
    vertices = 0;
    const segments = 64;
    if (kind === 'charge' || kind === 'roots') {
      const length = radius, sx = Math.cos(heading) * width, sz = Math.sin(heading) * width;
      for (let i = 0; i < segments; i++) {
        const a = length * i / segments, b = length * (i + 1) / segments;
        const ax = x + Math.sin(heading) * a, az = z - Math.cos(heading) * a, bx = x + Math.sin(heading) * b, bz = z - Math.cos(heading) * b;
        strip(buffer, ax - sx, az - sz, ax + sx, az + sz, bx - sx, bz - sz, bx + sx, bz + sz);
      }
    } else {
      const arc = kind === 'sweep' ? BOSS_ATTACKS.sweep.arc : Math.PI * 2, start = heading - arc / 2;
      for (let i = 0; i < segments; i++) {
        const a = start + arc * i / segments, b = start + arc * (i + 1) / segments, inner = Math.max(0, radius - width);
        strip(buffer, x + Math.sin(a) * inner, z - Math.cos(a) * inner, x + Math.sin(a) * radius, z - Math.cos(a) * radius, x + Math.sin(b) * inner, z - Math.cos(b) * inner, x + Math.sin(b) * radius, z - Math.cos(b) * radius);
      }
    }
    geometry.setDrawRange(0, vertices / 3); geometry.attributes.position.needsUpdate = true;
  }
  const bossFeet = [[-.43, -.58], [.43, -.58], [-.43, .8], [.43, .8]], catFeet = [[-.14, -.23], [.14, -.23], [-.14, .23], [.14, .23]];
  const up = new Vector3(0, 1, 0);
  legs.frustumCulled = false; hooves.frustumCulled = false; paws.frustumCulled = false; roots.frustumCulled = false; shadows.frustumCulled = false;
  function instance(mesh, index, x, y, z, sx, sy, sz, heading = 0) {
    position.set(x, y, z); scale.set(sx, sy, sz); rotation.setFromAxisAngle(up, -heading); mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
  }
  function update(state, simState, dt, reducedMotion) {
    const b = state.boss, p = state.pet, action = b.action, kind = action.kind, attack = BOSS_ATTACKS[kind];
    const ground = heightAt(b.x, b.z), progress = action.progress ?? action.elapsed / Math.max(.001, action.duration);
    const anticipation = Boolean(attack && action.elapsed < attack.telegraph), windup = anticipation ? Math.min(1, action.elapsed / attack.telegraph) : 0;
    const stunned = kind === 'stunned', defeated = kind === 'defeat', phase = kind === 'phase';
    const movingBoss = Math.hypot(b.x - previousBossX, b.z - previousBossZ) > .0001;
    previousBossX = b.x; previousBossZ = b.z;
    const gait = reducedMotion ? 0 : Math.sin(simState.elapsed * (kind === 'charge' && !anticipation ? 16 : 6));
    boss.position.set(b.x, ground, b.z); boss.rotation.y = -b.heading;
    const sweepActive = kind === 'sweep' ? Math.min(1, Math.max(0, (action.elapsed - attack.telegraph) / attack.active)) : 0;
    const sweepFold = kind === 'sweep' ? anticipation ? windup : Math.max(0, 1 - Math.max(0, action.elapsed - attack.telegraph - attack.active) / .45) : 0;
    const sweepTurn = kind === 'sweep' ? anticipation ? -attack.arc / 2 * windup : (sweepActive - .5) * attack.arc : 0;
    torso.position.y = defeated ? -.65 * Math.min(1, progress * 2) : stunned ? -.32 : -.7 * sweepFold;
    torso.rotation.set(kind === 'stomp' ? -.2 * (anticipation ? windup : Math.max(0, 1 - progress) * 2) : -.35 * sweepFold, -sweepTurn * sweepFold, reducedMotion || kind === 'sweep' ? 0 : Math.sin(simState.elapsed * 1.4) * .012);
    neck.rotation.x = stunned ? -.58 : kind === 'charge' ? -.65 * (anticipation ? windup : 1) : kind === 'roots' ? -.4 * windup : defeated ? -.4 : -1.2 * sweepFold;
    head.rotation.set(kind === 'stomp' ? .18 : 0, 0, 0);
    wood.emissive.set(b.flash > 0 ? '#725939' : anticipation ? '#3c2611' : phase ? '#63411c' : '#000000');
    amber.emissive.set(stunned ? '#ffb53c' : phase ? '#e68c25' : anticipation ? '#d48420' : '#a86720');
    heart.scale.setScalar(stunned ? 1.7 : 1 + (reducedMotion ? 0 : Math.sin(simState.elapsed * 3) * .04));
    heart.position.z = stunned ? -1.07 : -.87;
    const sin = Math.sin(b.heading), cos = Math.cos(b.heading);
    bossFeet.forEach(([lx, lz], i) => {
      const movement = kind === 'charge' && !anticipation || kind === 'idle' && movingBoss ? gait * .2 * (i === 0 || i === 3 ? 1 : -1) : 0;
      const x = b.x + lx * cos - (lz + movement) * sin, z = b.z + lx * sin + (lz + movement) * cos, footGround = heightAt(x, z);
      const lift = kind === 'stomp' && anticipation && i < 2 ? windup * .8 : movement ? Math.max(0, movement) * .65 : 0;
      const hipHeight = ground + 1.7 + torso.position.y, length = Math.max(.25, hipHeight - footGround - lift - .16);
      instance(legs, i, x, footGround + lift + .16 + length / 2, z, 1, length, 1, b.heading);
      instance(hooves, i, x, footGround + lift + .1, z, 1, 1, 1, b.heading);
    });
    legs.instanceMatrix.needsUpdate = true; hooves.instanceMatrix.needsUpdate = true;
    const catAction = p.action.kind, catProgress = p.action.progress ?? p.action.elapsed / Math.max(.001, p.action.duration);
    const leap = catAction === 'pounce' ? Math.sin(catProgress * Math.PI) * .65 : catAction === 'dash' ? .12 : 0;
    const catGround = Number.isFinite(p.ground) ? p.ground : heightAt(p.x,p.z);
    pet.position.set(p.x, catGround, p.z); pet.rotation.y = -p.heading;
    catBody.position.y = catAction === 'knockedOut' ? -.15 : leap;
    catBody.rotation.set(catAction === 'pounce' ? -.25 * Math.sin(catProgress * Math.PI * 2) : 0, catAction === 'spin' ? catProgress * Math.PI * 2 : catAction === 'swipe' ? Math.sin(catProgress * Math.PI * 2) * .6 : 0, catAction === 'knockedOut' ? Math.PI / 2 : 0);
    catTail.rotation.z = reducedMotion ? 0 : Math.sin(simState.elapsed * 5) * .22;
    ginger.emissive.set(p.flash > 0 ? '#806230' : catAction === 'dash' ? '#754b15' : '#000000');
    paws.visible = catAction !== 'knockedOut';
    const catSin = Math.sin(p.heading), catCos = Math.cos(p.heading), catStride = reducedMotion || catAction === 'idle' ? 0 : Math.sin(simState.elapsed * 15) * .09;
    catFeet.forEach(([lx, lz], i) => {
      const stride = catStride * (i === 0 || i === 3 ? 1 : -1), x = p.x + lx * catCos - (lz + stride) * catSin, z = p.z + lx * catSin + (lz + stride) * catCos;
      const lift = leap + Math.max(0, stride) * .6;
      instance(paws, i, x, catGround + .125 + lift, z, 1, 1, 1, p.heading);
    });
    paws.instanceMatrix.needsUpdate = true;
    const originX = action.originX ?? b.x, originZ = action.originZ ?? b.z;
    roots.visible = kind === 'roots' && !anticipation || phase;
    if (roots.visible) {
      for (let i = 0; i < 12; i++) {
        const distance = phase ? 1.2 + (i % 3) * .65 : .65 + i * 1.2;
        const angle = phase ? i * Math.PI * 2 / 12 : b.heading;
        const x = (phase ? b.x : originX) + Math.sin(angle) * distance, z = (phase ? b.z : originZ) - Math.cos(angle) * distance;
        const rise = phase ? Math.min(1, progress * 3) : Math.min(1, Math.max(0, (b.rootLength - distance) * 2));
        instance(roots, i, x, heightAt(x, z) + rise * .6, z, .9, Math.max(.001, rise * 1.2), .9);
      }
      roots.instanceMatrix.needsUpdate = true;
    }
    telegraph.visible = anticipation;
    if (anticipation) {
      const radius = attack.range;
      ribbon(telegraphGeometry, telegraphPositions, originX, originZ, b.heading, kind, radius, kind === 'charge' ? 1.9 : kind === 'roots' ? attack.width : kind === 'stomp' ? .22 : .65);
      telegraphMaterial.opacity = .2 + windup * .16;
    }
    effect.visible = kind === 'stomp' && b.ringRadius > 0 || kind === 'sweep' && !anticipation && action.elapsed < attack.telegraph + attack.active || kind === 'roots' && b.rootLength > 0;
    if (effect.visible) {
      const radius = kind === 'stomp' ? b.ringRadius : kind === 'roots' ? b.rootLength : attack.range;
      ribbon(effectGeometry, effectPositions, originX, originZ, b.heading, kind, radius, kind === 'roots' ? .17 : .28);
    }
    instance(shadows, 0, b.x, ground + .022, b.z, .8, 1, 1.45, b.heading);
    instance(shadows, 1, p.x, catGround + .024, p.z, .25, 1, .45, p.heading);
    shadows.instanceMatrix.needsUpdate = true;
    bossPosition[0] = b.x; bossPosition[1] = ground + 2.3; bossPosition[2] = b.z;
    petPosition[0] = p.x; petPosition[1] = catGround + .4; petPosition[2] = p.z;
  }
  return { update, bossPosition, petPosition, stonePositions: STONES.map(s => [s.x, heightAt(s.x, s.z), s.z]), campPosition: [ARENA.camp.x, heightAt(ARENA.camp.x, ARENA.camp.z), ARENA.camp.z] };
}
