import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Scene, Vector3 } from 'three';
import { createValley } from './valley.js';
import { wildsPaint } from './materials.js';
import { createValleyWorld, CAMPS, HERO_TREES, LAKE, SECRETS, SOLIDS, solidFootprint } from '../../core/wilds/world.js';
import { heightAt } from '../../core/world-terrain.js';
import { createFeelSimulation } from '../../core/wilds/feel.js';
import { createEncounter } from '../../core/wilds/encounter.js';
import { STONES } from '../../core/wilds/encounter.js';

const scene=new Scene(),world=createValleyWorld(),valley=createValley(scene,{world}),simulation=createFeelSimulation(),encounter=createEncounter();

test('valley owns a bounded set of scene resources with shaped trees, many individual leaves and pooled curved grass',()=>{
  let meshes=0;
  scene.traverse(object=>{if(object.isMesh){meshes++;assert.ok(object.geometry);assert.ok(object.material);assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));}});
  assert.ok(meshes<=60,`valley draws ${meshes}`);
  const trees=valley.diagnostics();assert.equal(trees.treeAnchors,HERO_TREES.filter(tree=>tree.hero!==false).length);assert.equal(trees.forestTrees,HERO_TREES.filter(tree=>tree.hero===false).length);
  assert.ok(scene.getObjectByName('near-irregular-leaves').geometry.attributes.position.count>10000);
  assert.equal(scene.getObjectByName('curved-grass').count,16000);
  assert.ok(scene.getObjectByName('curved-grass').geometry.attributes.position.count>=48);
});

test('each shared climbable solid has a visible top along its actual collision outline',()=>{
  const rock=scene.getObjectByName('climbable-rock-masses').geometry.attributes.position,ruins=scene.getObjectByName('ruin-masonry').geometry.attributes.position,wood=scene.getObjectByName('climbable-oak-wood').geometry.attributes.position;
  for(const solid of SOLIDS){
    const positions=solid.kind==='oak'||solid.id==='bridge-log'?wood:solid.kind==='ruin'?ruins:rock;
    for(const [x,z]of solidFootprint(solid)){
      let visible=false;for(let i=0;i<positions.count;i++)if(Math.abs(positions.getX(i)-x)<.0001&&Math.abs(positions.getY(i)-solid.top)<.0001&&Math.abs(positions.getZ(i)-z)<.0001){visible=true;break;}
      assert.ok(visible,solid.id);
    }
  }
});

test('lake is clipped to its connected basin with shallow depth data and does not cover the valley in a water plane',()=>{
  const lake=scene.getObjectByName('connected-lake'),positions=lake.geometry.attributes.position,depths=lake.geometry.attributes.waterDepth;
  let area=0;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i);assert.equal(positions.getY(i),LAKE.height);
    assert.ok(x>=LAKE.minX-.001&&x<=LAKE.maxX+.001&&z>=LAKE.minZ-.001&&z<=LAKE.maxZ+.001);
    assert.ok(heightAt(x,z)<=LAKE.height+.08);
    assert.ok(Math.abs(depths.getX(i)-Math.max(0,LAKE.height-heightAt(x,z)))<.0001);
    if(i%3===0){const ax=positions.getX(i+1)-x,az=positions.getZ(i+1)-z,bx=positions.getX(i+2)-x,bz=positions.getZ(i+2)-z;area+=Math.abs(ax*bz-az*bx)*.5;}
  }
  assert.ok(area>4000&&area<6500,`connected water area ${area}`);
});

test('streamed grass refills existing buffers incrementally and stays on the shared physical floor',()=>{
  const grass=scene.getObjectByName('curved-grass'),buffer=grass.instanceMatrix.array,geometry=grass.geometry,matrix=new Matrix4(),position=new Vector3(),scale=new Vector3();
  Object.assign(simulation.state.player,{x:-100,y:heightAt(-100,-300),z:-300});
  valley.update(simulation.state,encounter.state,{},1/60,false);
  assert.equal(valley.diagnostics().grassPending,27680);
  for(let i=0;i<88;i++)valley.update(simulation.state,encounter.state,{},1/60,false);
  assert.equal(valley.diagnostics().grassPending,0);assert.equal(grass.instanceMatrix.array,buffer);assert.equal(grass.geometry,geometry);
  for(let i=0;i<grass.count;i+=41){grass.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);if(scale.x<.01)continue;assert.ok(Math.abs(position.y-world.floorAt(position.x,position.z)-.005)<.0001);assert.equal(world.waterAt(position.x,position.z),null);}
});

test('exploration state hides found secrets and reduced motion disables the shared gust without replacing resources',()=>{
  const secret=SECRETS[0],material=scene.getObjectByName('curved-grass').material,shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <opaque_fragment>'};
  material.onBeforeCompile(shader);
  valley.update(simulation.state,encounter.state,{found:[secret.id]},1/60,true);
  assert.equal(scene.getObjectByName(`secret-${secret.id}`).visible,false);assert.equal(shader.uniforms.wildsWind.value,0);
  assert.equal(shader.uniforms.wildsPlayer.value.x,simulation.state.player.x);
  assert.match(shader.vertexShader,/wildsPetDelta/);
  valley.update(simulation.state,encounter.state,{found:[]},1/60,false);assert.equal(shader.uniforms.wildsWind.value,1);
});

test('painterly materials retain actual bound compiler uniforms without accumulating shader graphs',()=>{
  const material=wildsPaint('#819758'),a={uniforms:{dfgLUT:{value:{}}},fragmentShader:'#include <opaque_fragment>'},b={uniforms:{dfgLUT:{value:{}}},fragmentShader:'#include <opaque_fragment>'};
  material.onBeforeCompile(a);material.onBeforeCompile(b);assert.equal(material.userData.wildsUniforms.length,1);assert.equal(material.userData.wildsUniforms[0],b.uniforms);assert.match(b.fragmentShader,/float bands/);material.dispose();
});

test('forest templates carry broad canopies at multiple branch heights and fine grass uses two pooled tiers',()=>{
  for(let variant=0;variant<3;variant++){
    const crown=scene.getObjectByName(`forest-canopy-${variant}`).geometry,stem=scene.getObjectByName(`forest-trunks-${variant}`).geometry;
    crown.computeBoundingBox();assert.ok(crown.boundingBox.max.x-crown.boundingBox.min.x>.65);assert.ok(crown.boundingBox.min.y<.6);assert.ok(crown.boundingBox.max.y>.75);assert.ok(stem.attributes.position.count>2500);
    assert.equal(crown.attributes.position.count,13*122*12);assert.ok(crown.attributes.normal.array.every(Number.isFinite));
  }
  const grass=scene.getObjectByName('curved-grass').geometry;grass.computeBoundingBox();assert.ok(grass.boundingBox.max.y<.4);assert.ok(grass.attributes.position.count>=48);
  assert.equal(scene.getObjectByName('meadow-grass').count,12000);
  assert.equal(scene.getObjectByName('layered-sky-clouds'),undefined);
  assert.match(scene.getObjectByName('valley-sky').material.fragmentShader,/noiseCloud/);
});

test('canopy mottling uses world coordinates after the actual forest instance transform',()=>{
  const material=scene.getObjectByName('forest-canopy-0').material,shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};
  material.onBeforeCompile(shader);assert.match(shader.vertexShader,/wildsSurfaceTransform \*= instanceMatrix/);assert.match(shader.fragmentShader,/wildsLeafMottle/);
});

test('wind and foot parting compensate for instance scale while cool haze separates distant forms',()=>{
  const wind={wildsTime:{value:1},wildsWind:{value:1},wildsPlayer:{value:new Vector3()},wildsPet:{value:new Vector3()}};
  const material=wildsPaint('#819758',{wind,grass:true}),shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};
  material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/wildsInverseScale = 1\.0 \/ max\(wildsBasisLength/);
  assert.match(shader.vertexShader,/wildsWind \* wildsInverseScale\.x/);
  assert.match(shader.vertexShader,/wildsInverseScale\.x \* wildsInverseScale\.x \* wildsPart/);
  assert.equal(shader.uniforms.wildsGrassRange.value,12);assert.match(shader.vertexShader,/transformed \*= wildsCoverage/);
  assert.equal(shader.uniforms.wildsTime,wind.wildsTime);assert.ok(shader.uniforms.wildsHazeColor.value.isColor);assert.match(shader.fragmentShader,/length\(vViewPosition\) - 120\.0/);
  material.dispose();
});

test('nine faceted stones preserve collider height and carry wordless carved spiral geometry',()=>{
  const stones=scene.getObjectByName('valley-standing-stones'),spirals=scene.getObjectByName('carved-stone-spirals');
  assert.ok(stones.geometry.attributes.position.count>4000);assert.ok(spirals.geometry.attributes.position.count>=9*90*6);
  assert.ok(spirals.geometry.attributes.position.array.every(Number.isFinite));
  const position=stones.geometry.attributes.position,normal=stones.geometry.attributes.normal,first=STONES[0];
  assert.ok(normal.getX(0)*(position.getX(0)-first.x)+normal.getZ(0)*(position.getZ(0)-first.z)>0);
  valley.update(simulation.state,{...encounter.state,status:'fighting'}, {},1/60,false);assert.equal(spirals.material.opacity,.65);
  valley.update(simulation.state,{...encounter.state,status:'dormant'}, {},1/60,false);assert.equal(spirals.material.opacity,.25);
});

test('solid walls face outward so their physical climb faces remain visible',()=>{
  const rock=scene.getObjectByName('climbable-rock-masses').geometry,position=rock.attributes.position,normal=rock.attributes.normal;
  const solid=SOLIDS.find(item=>item.kind!=='oak'&&item.kind!=='ruin'&&item.id!=='bridge-log');
  assert.ok(normal.getZ(0)<-.9);
  assert.ok(Math.abs(position.getZ(0)-(solid.z-solid.halfZ))<.001);
});


test('camp cloth contains shaped folded sheets rather than only rectangular bed and planar roof faces',()=>{
  const cloth=scene.getObjectByName('camp-merchant-cloth');
  assert.ok(cloth.geometry.attributes.position.count>8000);
  const position=cloth.geometry.attributes.position;let low=Infinity,high=-Infinity;
  for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i);if(x>CAMPS[0].x+1&&x<CAMPS[0].x+1.5&&z>CAMPS[0].z-.5&&z<CAMPS[0].z+.5){low=Math.min(low,y);high=Math.max(high,y);}}
  assert.ok(high-low>.035);
});


test('unlit camps keep their props but reveal existing shared glow resources only when lit',()=>{
  const meadow=scene.getObjectByName('camp-meadow-glow'),clearing=scene.getObjectByName('camp-clearing-glow'),geometry=meadow.geometry,material=meadow.material;
  valley.update(simulation.state,encounter.state,{lit:['clearing']},1/60,false);
  assert.equal(clearing.visible,true);assert.equal(meadow.visible,false);assert.equal(scene.getObjectByName('grounded-camp-and-landmark-wood').visible,true);assert.equal(material,clearing.material);
  let meshesBefore=0;scene.traverse(object=>{if(object.isMesh)meshesBefore++;});
  valley.update(simulation.state,encounter.state,{lit:['clearing','meadow']},1/60,false);
  assert.equal(meadow.visible,true);assert.equal(meadow.geometry,geometry);assert.equal(meadow.material,material);
  let meshesAfter=0;scene.traverse(object=>{if(object.isMesh)meshesAfter++;});assert.equal(meshesAfter,meshesBefore);assert.ok(meshesAfter<=60);
});


test('spring grass keeps persistent instance colors and canopy layers extend below half trunk height',()=>{
  const grass=scene.getObjectByName('curved-grass'),colors=grass.instanceColor.array;
  let minimum=Infinity,maximum=-Infinity;for(let i=0;i<colors.length;i+=3){minimum=Math.min(minimum,colors[i]);maximum=Math.max(maximum,colors[i]);}assert.ok(maximum-minimum>.04);
  valley.update(simulation.state,encounter.state,{},1/60,false);assert.equal(grass.instanceColor.array,colors);
  const crown=scene.getObjectByName('forest-canopy-0').geometry;crown.computeBoundingBox();assert.ok(crown.boundingBox.min.y<.4);assert.ok(crown.boundingBox.max.x-crown.boundingBox.min.x>.8);
});


test('toroidal grass streaming preserves every overlapping interior cell during movement',()=>{
  const grass=scene.getObjectByName('curved-grass'),matrix=new Matrix4(),point=new Vector3(),size=new Vector3();
  Object.assign(simulation.state.player,{x:-100,z:-300});for(let i=0;i<90;i++)valley.update(simulation.state,encounter.state,{},1/60,false);
  const before=grass.instanceMatrix.array.slice(),colors=grass.instanceColor.array,buffer=grass.instanceMatrix.array,interior=[];
  for(let i=0;i<grass.count;i++){grass.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);size.setFromMatrixScale(matrix);if(size.x>.01&&Math.abs(point.x+100)<7&&Math.abs(point.z+300)<7)interior.push(i);}
  assert.ok(interior.length>1000);simulation.state.player.x+=.24;valley.update(simulation.state,encounter.state,{},1/60,false);
  assert.ok(valley.diagnostics().grassPending<500);
  for(const index of interior)assert.deepEqual(buffer.subarray(index*16,index*16+16),before.subarray(index*16,index*16+16));
  simulation.state.player.x+=4;valley.update(simulation.state,encounter.state,{},1/60,false);
  for(const index of interior)assert.deepEqual(buffer.subarray(index*16,index*16+16),before.subarray(index*16,index*16+16));
  assert.equal(grass.instanceMatrix.array,buffer);assert.equal(grass.instanceColor.array,colors);
  for(let frame=0;frame<20;frame++)valley.update(simulation.state,encounter.state,{},1/60,false);assert.equal(valley.diagnostics().grassPending,0);
});
