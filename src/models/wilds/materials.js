import { Color, MeshStandardMaterial } from 'three';

export function wildsPaint(color, { wind = null, foliage = false, grass = false, grassRange = 12, grassFade = 3, surface = 'plain', haze = true, ...options } = {}) {
  const material = new MeshStandardMaterial({ color, roughness: .9, ...options });
  material.userData.wildsUniforms = [];
  material.onBeforeCompile = shader => {
    material.userData.wildsUniforms.length = 0; material.userData.wildsUniforms.push(shader.uniforms);
    if (surface !== 'plain' || foliage && !grass) {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWildsSurface;').replace('#include <begin_vertex>', '#include <begin_vertex>\nmat4 wildsSurfaceTransform = modelMatrix;\n#ifdef USE_INSTANCING\n wildsSurfaceTransform *= instanceMatrix;\n#endif\nvWildsSurface = (wildsSurfaceTransform * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWildsSurface;');
    }
    if (haze) {
      shader.uniforms.wildsHazeColor = { value: new Color('#95b4c3') };
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 wildsHazeColor;');
    }
    if (wind) {
      Object.assign(shader.uniforms, wind);
      if(grass){shader.uniforms.wildsGrassRange={value:grassRange};shader.uniforms.wildsGrassFade={value:grassFade};shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vWildsBladeHeight;').replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(.12, 1.0, .06, 0.0)).xyz);');}
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        uniform float wildsTime;
        uniform float wildsWind;
        uniform vec3 wildsPlayer;
        uniform vec3 wildsPet;
        ${grass ? 'uniform float wildsGrassRange; uniform float wildsGrassFade; varying float vWildsBladeHeight;' : ''}
      `).replace('#include <begin_vertex>', `#include <begin_vertex>
        mat4 wildsTransform = modelMatrix;
        #ifdef USE_INSTANCING
          wildsTransform *= instanceMatrix;
        #endif
        vec3 wildsPosition = (wildsTransform * vec4(transformed, 1.0)).xyz;
        ${grass ? 'vWildsBladeHeight = position.y;' : ''}
        vec3 wildsBasisLength = vec3(length(wildsTransform[0].xyz), length(wildsTransform[1].xyz), length(wildsTransform[2].xyz));
        vec3 wildsInverseScale = 1.0 / max(wildsBasisLength, vec3(.0001));
        float wildsBend = ${grass ? 'pow(clamp(position.y / .42, 0.0, 1.0), 2.0)' : '1.0'};
        float wildsGust = sin(wildsTime * 1.6 + wildsPosition.x * .12 + wildsPosition.z * .08) * .11 + sin(wildsTime * .7 + wildsPosition.z * .025) * .09;
        transformed.x += wildsGust * wildsBend * wildsWind * wildsInverseScale.x;
        transformed.z += wildsGust * wildsBend * wildsWind * .4 * wildsInverseScale.z;
        ${grass ? `
          vec2 wildsDelta = wildsPosition.xz - wildsPlayer.xz;
          vec2 wildsPetDelta = wildsPosition.xz - wildsPet.xz;
          if (length(wildsPetDelta) < length(wildsDelta)) wildsDelta = wildsPetDelta;
          float wildsPart = (1.0 - smoothstep(.15, 1.1, length(wildsDelta))) * wildsBend;
          vec2 wildsDirection = wildsDelta / max(.08, length(wildsDelta));
          transformed.x += dot(wildsDirection, wildsTransform[0].xz) * wildsInverseScale.x * wildsInverseScale.x * wildsPart * .45;
          transformed.z += dot(wildsDirection, wildsTransform[2].xz) * wildsInverseScale.z * wildsInverseScale.z * wildsPart * .45;
          transformed.y -= wildsPart * .15 * wildsInverseScale.y;
          float wildsCoverage = 1.0 - smoothstep(wildsGrassRange - wildsGrassFade, wildsGrassRange, length(wildsPosition.xz - wildsPlayer.xz));
          transformed *= wildsCoverage;
        ` : ''}
      `);
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float luminance = max(.001, dot(outgoingLight, vec3(.2126, .7152, .0722)));
      float bands = floor(luminance * 4.0) / 4.0 + smoothstep(.28, .72, fract(luminance * 4.0)) / 4.0;
      outgoingLight *= mix(1.0, bands / luminance, .3);
      float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
      outgoingLight += diffuseColor.rgb * vec3(.055, .075, .085) + rim * ${grass ? 'vec3(.025, .04, .016)' : 'vec3(.07, .075, .035)'};
      ${foliage ? `outgoingLight += diffuseColor.rgb * ${grass ? '.04' : '.13'} * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);` : ''}
      ${grass ? 'outgoingLight *= .84 + smoothstep(.015, .28, vWildsBladeHeight) * .16; outgoingLight += diffuseColor.rgb * vec3(.035, .065, .026);' : ''}
      ${foliage && !grass ? 'vec3 wildsLeafP = vWildsSurface * 6.0; float wildsLeafMottle = sin(wildsLeafP.x + sin(wildsLeafP.z * .83)) * sin(wildsLeafP.y * 1.27 + sin(wildsLeafP.x * .71)) * sin(wildsLeafP.z * 1.11 + sin(wildsLeafP.y)); float wildsLeafFine = sin(wildsLeafP.x * 2.3 + wildsLeafP.z * .7) * sin(wildsLeafP.z * 2.6 + wildsLeafP.y); outgoingLight *= .91 + smoothstep(-.5, .5, wildsLeafMottle) * .22 + wildsLeafFine * .055; outgoingLight += diffuseColor.rgb * .055;' : ''}
      ${surface === 'bark' ? 'float grain = sin(vWildsSurface.x * 21.0 + vWildsSurface.z * 18.0 + sin(vWildsSurface.y * 1.7) * .55); float streak = pow(abs(grain), 9.0); float knots = sin(vWildsSurface.x * 9.0 + vWildsSurface.y * .37) * sin(vWildsSurface.z * 11.0 - vWildsSurface.y * .24); outgoingLight *= .87 + grain * .10 - streak * .13 + knots * .09;' : ''}
      ${surface === 'ground' ? 'float wildsPatch = sin(vWildsSurface.x * .47 + sin(vWildsSurface.z * .31) * 2.3) * sin(vWildsSurface.z * .38 + sin(vWildsSurface.x * .19)); float wildsFine = sin(vWildsSurface.x * 6.8 + sin(vWildsSurface.z * 4.1)) * sin(vWildsSurface.z * 7.2); outgoingLight *= .83 + wildsPatch * .14 + wildsFine * .035; outgoingLight = mix(outgoingLight, outgoingLight * vec3(.89, 1.03, .78), smoothstep(.1, .7, wildsPatch) * .45);' : surface === 'cloth' ? 'float weave = sin(vWildsSurface.x * 48.0) * sin((vWildsSurface.y + vWildsSurface.z) * 48.0); outgoingLight *= .97 + weave * .025;' : ''}
      ${haze ? 'float wildsHaze = 1.0 - exp(-max(0.0, length(vViewPosition) - 120.0) * .0012); outgoingLight = mix(outgoingLight, wildsHazeColor, wildsHaze);' : ''}
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => `wilds-paint-3-${Boolean(wind)}-${foliage}-${grass}-${surface}-${haze}`;
  return material;
}
