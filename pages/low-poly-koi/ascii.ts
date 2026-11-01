import * as THREE from 'three';

const CHARACTERS = ' .:-=+*#%@';
export const ASCII_SIZES = { original: 6, small: 4, fine: 3, micro: 2 } as const;
export type AsciiSize = keyof typeof ASCII_SIZES;

export function isAsciiSize(value: string | null): value is AsciiSize {
  return value !== null && Object.prototype.hasOwnProperty.call(ASCII_SIZES, value);
}

/** Draw the same pond through a luminance-selected monospace character atlas. */
export class AsciiPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  });
  private readonly atlas: THREE.CanvasTexture;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = 32 * CHARACTERS.length;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('ASCII character atlas requires Canvas 2D');
    context.fillStyle = '#fff';
    context.font = 'bold 44px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    [...CHARACTERS].forEach((character, index) => context.fillText(character, index * 32 + 16, 25));
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.generateMipmaps = false;
    this.atlas.minFilter = THREE.LinearFilter;
    this.atlas.magFilter = THREE.LinearFilter;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: this.target.texture },
        uAtlas: { value: this.atlas },
        uGrid: { value: new THREE.Vector2(1, 1) },
        uCharacters: { value: CHARACTERS.length },
        uBackground: { value: new THREE.Color('#1d4ce9') },
        uInk: { value: new THREE.Color('#f3f7ff') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D uScene, uAtlas;
        uniform vec2 uGrid;
        uniform float uCharacters;
        uniform vec3 uBackground, uInk;
        varying vec2 vUv;
        void main() {
          vec2 cell = floor(vUv * uGrid);
          vec4 source = texture2D(uScene, (cell + 0.5) / uGrid);
          // The source is rendered over transparent black: fin opacity is
          // already reflected in RGB, so do not multiply by alpha a second time.
          float luminance = clamp(dot(source.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
          float character = min(floor(pow(luminance, 0.8) * uCharacters), uCharacters - 1.0);
          vec2 withinCell = fract(vUv * uGrid);
          float ink = texture2D(uAtlas, vec2((character + withinCell.x) / uCharacters, withinCell.y)).a;
          gl_FragColor = vec4(mix(uBackground, uInk, ink), 1.0);
          #include <colorspace_fragment>
        }
      `,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }

  resize(width: number, height: number, size: AsciiSize = 'small') {
    const cellWidth = ASCII_SIZES[size] * (width < 600 ? 0.75 : 1);
    const columns = Math.max(1, Math.floor(width / cellWidth));
    const rows = Math.max(1, Math.floor(height / (cellWidth * 1.5)));
    this.target.setSize(columns, rows);
    this.material.uniforms.uGrid.value.set(columns, rows);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const target = renderer.getRenderTarget();
    const color = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      renderer.setRenderTarget(target);
      renderer.setClearColor('#1d4ce9', 1);
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(target);
      renderer.setClearColor(color, alpha);
    }
  }

  dispose() {
    this.target.dispose();
    this.atlas.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
