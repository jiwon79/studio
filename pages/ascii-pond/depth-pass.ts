import * as THREE from 'three';
import type { AsciiPass } from './ascii';

/** Blur the finished glyphs, rather than turning blurred fish back into sharp text. */
export class PondDepthPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: this.target.texture }, uDepth: { value: this.target.depthTexture },
      uPixel: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 1.6 },
      uNear: { value: 0.1 }, uFar: { value: 10 }, uSurface: { value: 4 },
      uWater: { value: new THREE.Color('#1d4ce9') },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uColor, uDepth;
      uniform vec2 uPixel;
      uniform float uBlur, uNear, uFar, uSurface;
      uniform vec3 uWater;
      varying vec2 vUv;
      float depthAt(vec2 uv) {
        float raw = texture2D(uDepth, uv).r;
        if (raw > 0.9999) return 0.0;
        return clamp((mix(uNear, uFar, raw) - uSurface) / 1.15, 0.0, 1.0);
      }
      void main() {
        float depth = depthAt(vUv);
        // Extend the blur slightly into empty water around deep silhouettes.
        if (texture2D(uDepth, vUv).r > 0.9999) {
          vec2 rim = uPixel * uBlur * 2.0;
          depth = max(max(depthAt(vUv + vec2(rim.x, 0.0)), depthAt(vUv - vec2(rim.x, 0.0))),
                      max(depthAt(vUv + vec2(0.0, rim.y)), depthAt(vUv - vec2(0.0, rim.y))));
        }
        vec2 r = uPixel * uBlur * depth;
        vec3 color = texture2D(uColor, vUv).rgb * 0.25;
        color += (texture2D(uColor, vUv + vec2(r.x, 0.0)).rgb + texture2D(uColor, vUv - vec2(r.x, 0.0)).rgb
                + texture2D(uColor, vUv + vec2(0.0, r.y)).rgb + texture2D(uColor, vUv - vec2(0.0, r.y)).rgb) * 0.125;
        color += (texture2D(uColor, vUv + r).rgb + texture2D(uColor, vUv - r).rgb
                + texture2D(uColor, vUv + vec2(r.x, -r.y)).rgb + texture2D(uColor, vUv + vec2(-r.x, r.y)).rgb) * 0.0625;
        gl_FragColor = vec4(mix(color, uWater, depth * 0.5), 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  });

  constructor() { this.scene.add(new THREE.Mesh(this.geometry, this.material)); }

  resize(width: number, height: number) {
    const ratio = Math.min(devicePixelRatio, 1.5);
    this.target.setSize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));
    this.material.uniforms.uPixel.value.set(1 / this.target.width, 1 / this.target.height);
    this.material.uniforms.uBlur.value = 1.6 * ratio;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera, ascii?: AsciiPass) {
    const previous = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(this.target);
      if (ascii) ascii.render(renderer, scene, camera);
      else renderer.render(scene, camera);
      this.material.uniforms.uDepth.value = ascii ? ascii.depthTexture : this.target.depthTexture;
      this.material.uniforms.uNear.value = camera.near;
      this.material.uniforms.uFar.value = camera.far;
      this.material.uniforms.uSurface.value = camera.position.z;
      renderer.setRenderTarget(previous);
      renderer.render(this.scene, this.camera);
    } finally { renderer.setRenderTarget(previous); }
  }

  dispose() {
    this.target.depthTexture?.dispose(); this.target.dispose();
    this.geometry.dispose(); this.material.dispose();
  }
}
