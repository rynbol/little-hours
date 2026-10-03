import { BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, SphereGeometry } from 'three';
import { heightAt, normalAt } from '../../core/world-terrain.js';
import { ATTACKS, DUMMY, POSTS } from '../../core/wilds/feel.js';

function paint(color, options = {}) {
  const material = new MeshStandardMaterial({ color, roughness: .88, ...options });
  material.userData.wildsUniforms = [];
  material.onBeforeCompile = shader => {
    material.userData.wildsUniforms.push(shader.uniforms);
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

export function createFeelBox(scene) {
  const terrain = new PlaneGeometry(128, 128, 128, 128);
  terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position, normals = terrain.attributes.normal, colors = new Float32Array(positions.count * 3);
  const color = new Color(), low = new Color('#729364'), high = new Color('#a6b881');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), normal = normalAt(x, z);
    positions.setY(i, heightAt(x, z)); normals.setXYZ(i, ...normal);
    const variation = .34 + .13 * Math.sin(x * .17 + Math.sin(z * .23)) + .14 * Math.cos(z * .21) + (1 - normal[1]) * .8;
    color.copy(low).lerp(high, variation);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  terrain.setAttribute('color', new BufferAttribute(colors, 3));
  const ground = new Mesh(terrain, paint('#ffffff', { vertexColors: true }));
  ground.receiveShadow = true; scene.add(ground);
  const postMaterial = paint('#d2cbb6'), capMaterial = paint('#7e8a85');
  for (const post of POSTS) {
    const mesh = new Mesh(new CylinderGeometry(post.radius * .92, post.radius, post.height, 12), postMaterial);
    mesh.position.set(post.x, heightAt(post.x, post.z) + post.height / 2, post.z);
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    const cap = new Mesh(new CylinderGeometry(post.radius * .93, post.radius * .93, .1, 12), capMaterial);
    cap.position.copy(mesh.position); cap.position.y += post.height / 2 - .14; cap.castShadow = true; scene.add(cap);
  }
  const boundary = new Mesh(new RingGeometry(43.7, 44, 192), new MeshBasicMaterial({ color: '#d0d5a2', side: DoubleSide, transparent: true, opacity: .25 }));
  boundary.rotation.x = -Math.PI / 2;
  const ringPosition = boundary.geometry.attributes.position;
  boundary.rotation.x = 0;
  for (let i = 0; i < ringPosition.count; i++) {
    const x = ringPosition.getX(i), z = ringPosition.getY(i) - 4;
    ringPosition.setXYZ(i, x, heightAt(x, z) + .018, z);
  }
  scene.add(boundary);
  const dummy = new Group(); dummy.position.set(DUMMY.x, heightAt(DUMMY.x, DUMMY.z), DUMMY.z);
  const dummyMaterial = paint('#bb9371'), dummyPale = paint('#e8d7ac');
  const stem = new Mesh(new CylinderGeometry(.11, .17, 1.7, 10), capMaterial); stem.position.y = .85;
  const chest = new Mesh(new CylinderGeometry(.4, .32, .66, 14), dummyMaterial); chest.position.y = 1.12;
  const head = new Mesh(new SphereGeometry(.27, 16, 10), dummyPale); head.position.y = 1.69;
  const arms = new Mesh(new BoxGeometry(1.5, .13, .16), dummyMaterial); arms.position.y = 1.31;
  const target = new Mesh(new CircleGeometry(.21, 24), dummyPale); target.position.set(0, 1.13, .402);
  dummy.add(stem, chest, head, arms, target);
  dummy.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } }); scene.add(dummy);
  const player = new Group(), body = new Group(); player.add(body);
  const capsule = new Mesh(new CapsuleGeometry(.28, .94, 8, 16), paint('#afb7b6')); capsule.position.y = .75; capsule.castShadow = true; body.add(capsule);
  const facing = new Mesh(new BoxGeometry(.24, .065, .06), paint('#586b71')); facing.position.set(0, 1.28, -.256); body.add(facing);
  const belt = new Mesh(new CylinderGeometry(.286, .286, .065, 20), capMaterial); belt.position.y = .68; body.add(belt);
  const sword = new Group(), steel = paint('#d9e5df', { roughness: .36, metalness: .15 }), grip = paint('#6d7773');
  const blade = new Mesh(new BoxGeometry(.095, .045, 1), steel); blade.position.z = -1; blade.castShadow = true;
  const guard = new Mesh(new BoxGeometry(.28, .08, .08), grip); guard.position.z = -.48;
  const handle = new Mesh(new CylinderGeometry(.045, .045, .23, 8), grip); handle.rotation.x = Math.PI / 2; handle.position.z = -.33;
  sword.add(blade, guard, handle); sword.position.y = .97; body.add(sword); scene.add(player);
  const trailGeometry = new BufferGeometry(), trailPositions = new Float32Array(12 * 6 * 3);
  trailGeometry.setAttribute('position', new BufferAttribute(trailPositions, 3));
  const trailMaterial = new MeshBasicMaterial({ color: '#fff0c7', transparent: true, opacity: .6, side: DoubleSide, depthWrite: false });
  const trail = new Mesh(trailGeometry, trailMaterial); trail.frustumCulled = false; player.add(trail);
  const sparkGroup = new Group(), sparkMaterial = new MeshBasicMaterial({ color: '#fff1be', transparent: true, opacity: 1 });
  const sparkGeometry = new BoxGeometry(.055, .055, .13), sparks = [];
  for (let i = 0; i < 10; i++) { const spark = new Mesh(sparkGeometry, sparkMaterial); sparkGroup.add(spark); sparks.push(spark); }
  scene.add(sparkGroup);
  const shadowMaterial = new MeshBasicMaterial({ color: '#253c38', transparent: true, opacity: .16, depthWrite: false });
  const shadow = new Mesh(new CircleGeometry(.42, 32), shadowMaterial); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  let lastHit = 0, burst = 1;

  function update(state, dt, reducedMotion) {
    const p = state.player, action = state.action, attack = ATTACKS[action.kind];
    player.position.set(p.x, p.y, p.z); player.rotation.y = -p.heading;
    const speed = Math.hypot(p.vx, p.vz), stride = Math.sin(state.elapsed * (action.kind === 'sprint' ? 18 : 14));
    body.position.y = p.grounded && speed > .5 && !reducedMotion ? Math.abs(stride) * .038 : 0;
    body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
    if (action.kind === 'dodge') {
      body.rotation.x = -action.progress * Math.PI * 2;
      body.position.y = .28 + .47 * Math.abs(Math.cos(body.rotation.x)); capsule.position.y = 0; facing.position.y = .53; belt.position.y = -.07;
    } else {
      capsule.position.y = .75; facing.position.y = 1.28; belt.position.y = .68;
      if (action.kind === 'land' && !reducedMotion) body.scale.set(1.1, .86 + action.progress * .14, 1.1);
      else if (action.kind === 'run' || action.kind === 'sprint') body.rotation.x = -Math.min(.1, speed * .015);
    }
    sword.rotation.set(0, attack ? -action.swingAngle : -.6, action.kind === 'charge' ? -.35 : 0);
    sword.position.set(attack ? 0 : .22, action.kind === 'charge' ? 1.22 : .97, .02);
    blade.scale.z = attack ? attack.range - .5 : .95;
    if (action.kind === 'dodge') { sword.position.set(.38, -.7, .02); sword.rotation.set(Math.PI / 2, 0, 0); }
    blade.position.z = -.5 - blade.scale.z / 2;
    steel.emissive.set(action.kind === 'charge' && action.charge >= 1 ? '#998a4f' : '#000000');
    const visibleTrail = Boolean(attack && action.elapsed >= attack.hitStart && action.elapsed < attack.hitEnd + .08);
    trail.visible = visibleTrail;
    if (visibleTrail) {
      const end = action.swingAngle, start = end - .65, radius = attack.range;
      for (let i = 0; i < 12; i++) {
        const a = start + (end - start) * i / 12, b = start + (end - start) * (i + 1) / 12;
        const points = [[a, radius], [a, radius - .24], [b, radius], [b, radius], [a, radius - .24], [b, radius - .24]];
        points.forEach(([angle, r], j) => trailPositions.set([Math.sin(angle) * r, .98, -Math.cos(angle) * r], (i * 6 + j) * 3));
      }
      trailGeometry.attributes.position.needsUpdate = true;
      trailMaterial.opacity = action.elapsed > attack.hitEnd ? .6 * (1 - (action.elapsed - attack.hitEnd) / .08) : .6;
    }
    dummyMaterial.emissive.set(state.dummy.flash > 0 ? '#b78e49' : '#000000');
    dummy.rotation.x = reducedMotion ? 0 : -Math.sin(state.dummy.flash * 26) * state.dummy.flash * .65;
    if (state.lastHit && state.lastHit.serial !== lastHit) {
      lastHit = state.lastHit.serial; burst = 0;
      sparkGroup.position.set(state.lastHit.x, state.lastHit.y, state.lastHit.z + .38);
    }
    burst += dt; sparkGroup.visible = burst < .24;
    if (sparkGroup.visible) {
      sparkMaterial.opacity = 1 - burst / .24;
      sparks.forEach((spark, i) => {
        const angle = i * 2.399;
        spark.position.set(Math.cos(angle) * burst * 2.6, Math.sin(angle) * burst * 1.9, burst * .7);
        spark.rotation.set(angle, 0, angle); spark.scale.setScalar(reducedMotion ? .5 : 1);
      });
    }
    shadow.position.set(p.x, heightAt(p.x, p.z) + .016, p.z);
    shadow.scale.setScalar(1 + (p.y - heightAt(p.x, p.z)) * .14);
    shadowMaterial.opacity = .16 / (1 + p.y - heightAt(p.x, p.z));
  }

  return { update, dummyPosition: [DUMMY.x, heightAt(DUMMY.x, DUMMY.z), DUMMY.z] };
}
