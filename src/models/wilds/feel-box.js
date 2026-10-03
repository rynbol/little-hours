import { BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, SphereGeometry, Vector3, Quaternion } from 'three';
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

export function createFeelBox(scene, { training = true, world = null, bladeEndpoints = null } = {}) {
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
  ground.receiveShadow = true; ground.visible = training; scene.add(ground);
  const postMaterial = paint('#d2cbb6'), capMaterial = paint('#7e8a85');
  for (const post of training ? POSTS : []) {
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
  boundary.visible = training; scene.add(boundary);
  const dummy = new Group(); dummy.position.set(DUMMY.x, heightAt(DUMMY.x, DUMMY.z), DUMMY.z);
  const dummyMaterial = paint('#bb9371'), dummyPale = paint('#e8d7ac');
  const stem = new Mesh(new CylinderGeometry(.11, .17, 1.7, 10), capMaterial); stem.position.y = .85;
  const chest = new Mesh(new CylinderGeometry(.4, .32, .66, 14), dummyMaterial); chest.position.y = 1.12;
  const head = new Mesh(new SphereGeometry(.27, 16, 10), dummyPale); head.position.y = 1.69;
  const arms = new Mesh(new BoxGeometry(1.5, .13, .16), dummyMaterial); arms.position.y = 1.31;
  const target = new Mesh(new CircleGeometry(.21, 24), dummyPale); target.position.set(0, 1.13, .402);
  dummy.add(stem, chest, head, arms, target);
  dummy.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } }); scene.add(dummy);
  const trailGeometry = new BufferGeometry(), trailPositions = new Float32Array(12 * 6 * 3);
  trailGeometry.setAttribute('position', new BufferAttribute(trailPositions, 3));
  const trailMaterial = new MeshBasicMaterial({ color: '#fff0c7', transparent: true, opacity: .6, side: DoubleSide, depthWrite: false });
  const trail = new Mesh(trailGeometry, trailMaterial); trail.frustumCulled = false; trail.name = 'blade-trail'; scene.add(trail);
  const base = new Vector3(), tip = new Vector3(), history = new Float32Array(13 * 6);
  const up = new Vector3(0, 1, 0), groundNormal = new Vector3(), shadowTilt = new Quaternion();
  let historyCount = 0, trailSerial = -1, lastPetHit = 0;
  const sparkGroup = new Group(), sparkMaterial = new MeshBasicMaterial({ color: '#fff1be', transparent: true, opacity: 1 });
  const sparkGeometry = new BoxGeometry(.055, .055, .13), sparks = [];
  for (let i = 0; i < 10; i++) { const spark = new Mesh(sparkGeometry, sparkMaterial); sparkGroup.add(spark); sparks.push(spark); }
  scene.add(sparkGroup);
  const shadowMaterial = new MeshBasicMaterial({ color: '#253c38', transparent: true, opacity: .16, depthWrite: false });
  const shadow = new Mesh(new CircleGeometry(.42, 32), shadowMaterial); shadow.geometry.rotateX(-Math.PI / 2); shadow.name = 'hero-contact-shadow'; scene.add(shadow);
  let lastHit = 0, burst = 1;

  function update(state, dt, reducedMotion, encounter = null) {
    const p = state.player, action = state.action, attack = ATTACKS[action.kind];
    const visibleTrail = Boolean(attack && action.elapsed >= attack.hitStart && action.elapsed < attack.hitEnd + .08 && bladeEndpoints);
    if (trailSerial !== action.serial || !visibleTrail) { historyCount = 0; trailSerial = action.serial; }
    if (visibleTrail && dt > 0 && bladeEndpoints(base, tip)) {
      history.copyWithin(6, 0, Math.min(historyCount, 12) * 6);
      base.toArray(history, 0); tip.toArray(history, 3); historyCount = Math.min(13, historyCount + 1);
      for (let i = 0; i < historyCount - 1; i++) {
        const a = i * 6, b = a + 6;
        for (const [j, offset] of [a, a + 3, b, b, a + 3, b + 3].entries()) trailPositions.set(history.subarray(offset, offset + 3), i * 18 + j * 3);
      }
      trailGeometry.setDrawRange(0, (historyCount - 1) * 6);
      trailGeometry.attributes.position.needsUpdate = true;
    }
    trail.visible = visibleTrail && historyCount > 1;
    trailMaterial.opacity = attack && action.elapsed > attack.hitEnd ? .6 * (1 - (action.elapsed - attack.hitEnd) / .08) : .6;
    dummyMaterial.emissive.set(state.dummy.flash > 0 ? '#b78e49' : '#000000');
    dummy.rotation.x = reducedMotion ? 0 : -Math.sin(state.dummy.flash * 26) * state.dummy.flash * .65;
    if (state.lastHit && state.lastHit.serial !== lastHit) {
      lastHit = state.lastHit.serial; burst = 0;
      sparkGroup.position.set(state.lastHit.x, state.lastHit.y, state.lastHit.z + .38);
    }
    for (const event of encounter?.impacts || []) if (event.kind === 'petAttack' && event.serial > lastPetHit) {
      lastPetHit = event.serial; burst = 0; sparkGroup.position.set(event.x, event.y, event.z);
    }
    if (encounter && !encounter.impacts.length && encounter.elapsed < .1) lastPetHit = 0;
    burst += dt; sparkGroup.visible = burst < .24;
    if (sparkGroup.visible) {
      sparkMaterial.opacity = 1 - burst / .24;
      sparks.forEach((spark, i) => {
        const angle = i * 2.399;
        spark.position.set(Math.cos(angle) * burst * 2.6, Math.sin(angle) * burst * 1.9, burst * .7);
        spark.rotation.set(angle, 0, angle); spark.scale.setScalar(reducedMotion ? .5 : 1);
      });
    }
    const support = world ? world.floorAt(p.x, p.z, p.y + .1) : heightAt(p.x, p.z);
    shadow.position.set(p.x, support + .016, p.z);
    groundNormal.set(0,1,0); if(Math.abs(support-heightAt(p.x,p.z))<.1)groundNormal.fromArray(normalAt(p.x, p.z)); shadow.quaternion.copy(shadowTilt.setFromUnitVectors(up, groundNormal));
    shadow.scale.setScalar(1 + (p.y - support) * .14);
    shadowMaterial.opacity = .16 / (1 + p.y - support);
  }

  return { update, dummyPosition: [DUMMY.x, heightAt(DUMMY.x, DUMMY.z), DUMMY.z] };
}
