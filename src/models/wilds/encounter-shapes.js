import { BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { heightAt, normalAt } from '../../core/world-terrain.js';
import { BOSS_ATTACKS } from '../../core/wilds/encounter.js';

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

export function createEncounterShapes(scene) {
  const wood = paint('#766c50');
  const matrix = new Matrix4(), rotation = new Quaternion(), scale = new Vector3(), position = new Vector3();
  const roots = new InstancedMesh(new CylinderGeometry(.025, .16, 1, 6), wood, 12); roots.name = 'erupting-roots'; roots.castShadow = true; roots.visible = false; scene.add(roots);
  const petalGeometry=new BufferGeometry();
  petalGeometry.setAttribute('position',new BufferAttribute(new Float32Array([0,0,0,-.075,.09,.01,0,.18,-.018,0,0,0,0,.18,-.018,.075,.09,.01]),3));petalGeometry.computeVertexNormals();
  const petalMaterial=paint('#ffffff');petalMaterial.side=DoubleSide;
  const blossoms=new InstancedMesh(petalGeometry,petalMaterial,80);blossoms.name='guardian-blossoms';blossoms.frustumCulled=false;blossoms.visible=false;scene.add(blossoms);
  const petalColors=['#e9e3ce','#c9d5af','#829c68','#eddbcc'],petalAxis=new Vector3(.6,.3,.7).normalize();
  for(let i=0;i<blossoms.count;i++)blossoms.setColorAt(i,new Color(petalColors[i%petalColors.length]));
  const shadowMaterial = new MeshBasicMaterial({ color: '#263e36', transparent: true, opacity: .18, depthWrite: false });
  const shadows = new InstancedMesh(new CircleGeometry(1, 24).rotateX(-Math.PI / 2), shadowMaterial, 2); shadows.name = 'encounter-contact-shadows'; scene.add(shadows);
  const telegraphMaterial = new MeshBasicMaterial({ color: '#e3ba77', transparent: true, opacity: .24, side: DoubleSide, depthWrite: false });
  const effectMaterial = new MeshBasicMaterial({ color: '#ffe0a1', transparent: true, opacity: .7, side: DoubleSide, depthWrite: false });
  const telegraphGeometry = new BufferGeometry(), effectGeometry = new BufferGeometry();
  const telegraphPositions = new Float32Array(96 * 18), effectPositions = new Float32Array(96 * 18);
  telegraphGeometry.setAttribute('position', new BufferAttribute(telegraphPositions, 3)); effectGeometry.setAttribute('position', new BufferAttribute(effectPositions, 3));
  const telegraph = new Mesh(telegraphGeometry, telegraphMaterial), effect = new Mesh(effectGeometry, effectMaterial);
  telegraph.name = 'attack-telegraph'; effect.name = 'attack-impact'; telegraph.frustumCulled = false; effect.frustumCulled = false; scene.add(telegraph, effect);
  let vertices = 0;
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
  const up = new Vector3(0, 1, 0), shadowNormal = new Vector3(), shadowYaw = new Quaternion();
  roots.frustumCulled = false; shadows.frustumCulled = false;
  function instance(mesh, index, x, y, z, sx, sy, sz, heading = 0) {
    position.set(x, y, z); scale.set(sx, sy, sz); rotation.setFromAxisAngle(up, -heading); mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
  }
  function update(state, simState, dt, reducedMotion) {
    const b = state.boss, p = state.pet, action = b.action, kind = action.kind, attack = BOSS_ATTACKS[kind];
    const ground = heightAt(b.x, b.z), progress = action.progress ?? action.elapsed / Math.max(.001, action.duration);
    const anticipation = Boolean(attack && action.elapsed < attack.telegraph), windup = anticipation ? Math.min(1, action.elapsed / attack.telegraph) : 0;
    const phase = kind === 'phase';
    const catGround = Number.isFinite(p.ground) ? p.ground : heightAt(p.x,p.z);
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
    const bloomTime=Math.max(0,action.elapsed-.75),bloomFade=Math.max(0,Math.min(1,(3-action.elapsed)*2));
    blossoms.visible=kind==='defeat' && bloomTime>0 && bloomFade>0;
    if(blossoms.visible){
      for(let i=0;i<blossoms.count;i++){
        const angle=i*2.399963,spread=(.3+(i%7)*.09)*(reducedMotion?.3:bloomTime*1.8),lift=Math.sin(i*1.77)*.45;
        const x=b.x+Math.sin(angle)*spread,z=b.z+Math.cos(angle)*spread,y=Math.max(heightAt(x,z)+.035,ground+1.4+lift+bloomTime*.65-bloomTime*bloomTime*.36);
        position.set(x,y,z);scale.setScalar((.75+(i%5)*.19)*bloomFade);rotation.setFromAxisAngle(petalAxis,angle+(reducedMotion?0:bloomTime*(i%2?-2:2.8)));blossoms.setMatrixAt(i,matrix.compose(position,rotation,scale));
      }
      blossoms.instanceMatrix.needsUpdate=true;
    }
    const guardianShadow=kind==='defeat'?Math.max(0,1-action.elapsed/3):1;
    position.set(b.x,ground+.022,b.z);scale.set(.8*guardianShadow,1,1.45*guardianShadow);shadowNormal.fromArray(normalAt(b.x,b.z));rotation.setFromUnitVectors(up,shadowNormal).multiply(shadowYaw.setFromAxisAngle(up,-b.heading));shadows.setMatrixAt(0,matrix.compose(position,rotation,scale));
    const petScale = 1 + Math.max(0, p.y - catGround) * .2;
    position.set(p.x,catGround+.024,p.z);scale.set(.25*petScale,1,.45*petScale);shadowNormal.set(0,1,0);if(Math.abs(catGround-heightAt(p.x,p.z))<.1)shadowNormal.fromArray(normalAt(p.x,p.z));rotation.setFromUnitVectors(up,shadowNormal).multiply(shadowYaw.setFromAxisAngle(up,-p.heading));shadows.setMatrixAt(1,matrix.compose(position,rotation,scale));
    shadows.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
