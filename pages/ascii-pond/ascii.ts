import * as THREE from 'three';

export const ASCII_CELL_WIDTH = 16 / 3;
export const ASCII_STYLES = {
  classic: { characters: ' .:-=+*#%@', gamma: 0.8, variation: 0.8 },
  dots: { characters: ' .,:;oO08@', gamma: 1.05, variation: 1.4 },
  lines: { characters: ' ._-~=/|\\+*#', gamma: 1.2, variation: 2.8 },
  code: { characters: ' .:01<>[]{}', gamma: 0.9, variation: 2.2 },
  blocks: { characters: ' .:░▒▓█', gamma: 1.1, variation: 0.8 },
} as const;
export type AsciiStyle = keyof typeof ASCII_STYLES;
export function isAsciiStyle(value: string | null): value is AsciiStyle {
  return value !== null && Object.prototype.hasOwnProperty.call(ASCII_STYLES, value);
}

/** Draw the same pond through a luminance-selected monospace character atlas. */
export class AsciiPass {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  get depthTexture() { return this.target.depthTexture!; }
  private atlas: THREE.CanvasTexture;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();

  constructor(style: AsciiStyle = 'classic') {
    this.atlas = this.makeAtlas(style);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: this.target.texture },
        uAtlas: { value: this.atlas },
        uGrid: { value: new THREE.Vector2(1, 1) },
        uCharacters: { value: ASCII_STYLES[style].characters.length },
        uGamma: { value: ASCII_STYLES[style].gamma },
        uVariation: { value: ASCII_STYLES[style].variation },
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
        uniform float uCharacters, uGamma, uVariation;
        uniform vec3 uBackground, uInk;
        varying vec2 vUv;
        void main() {
          vec2 cell = floor(vUv * uGrid);
          vec4 source = texture2D(uScene, (cell + 0.5) / uGrid);
          // The source is rendered over transparent black: fin opacity is
          // already reflected in RGB, so do not multiply by alpha a second time.
          float luminance = clamp(dot(source.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
          // Stable cell noise adds texture without flickering between frames.
          float grain = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453) - 0.5;
          float character = luminance < 0.015 ? 0.0 : clamp(floor(pow(luminance, uGamma) * (uCharacters - 1.0)
            + grain * uVariation), 1.0, uCharacters - 1.0);
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

  private makeAtlas(style: AsciiStyle) {
    const characters = ASCII_STYLES[style].characters;
    const canvas = document.createElement('canvas');
    canvas.width = 32 * characters.length;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('ASCII character atlas requires Canvas 2D');
    context.fillStyle = '#fff';
    context.font = 'bold 44px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    [...characters].forEach((character, index) => context.fillText(character, index * 32 + 16, 25));
    const atlas = new THREE.CanvasTexture(canvas);
    atlas.generateMipmaps = false;
    atlas.minFilter = THREE.LinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    return atlas;
  }

  setStyle(style: AsciiStyle) {
    const next = this.makeAtlas(style);
    this.atlas.dispose();
    this.atlas = next;
    this.material.uniforms.uAtlas.value = next;
    this.material.uniforms.uCharacters.value = ASCII_STYLES[style].characters.length;
    this.material.uniforms.uGamma.value = ASCII_STYLES[style].gamma;
    this.material.uniforms.uVariation.value = ASCII_STYLES[style].variation;
  }

  resize(width: number, height: number) {
    const cellWidth = ASCII_CELL_WIDTH * (width < 600 ? 0.75 : 1);
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
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.atlas.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
