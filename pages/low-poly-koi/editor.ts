import { cornerResize, type Bounds, type Corner, type XY } from './editor-model';

type Tool = 'select' | 'draw' | 'swim';
interface Host<State> {
  nodes(): { id: number; bounds: Bounds }[];
  add(points: XY[]): number;
  translate(id: number, dx: number, dy: number): void;
  scale(id: number, pivot: XY, ratio: number): number;
  remove(id: number): void;
  capture(): State;
  restore(state: State): void;
  changed(): void;
}

export class PondEditor<State> {
  private readonly events = new AbortController();
  private readonly box = document.querySelector<HTMLElement>('.selection')!;
  private readonly label = document.querySelector<HTMLElement>('.selection-size')!;
  private readonly outline = document.querySelector<SVGPathElement>('.sketch path')!;
  private readonly hint = document.querySelector<HTMLElement>('.hint')!;
  private readonly toolbar = [...document.querySelectorAll<HTMLButtonElement>('[data-tool]')];
  private readonly undoStack: State[] = [];
  private readonly redoStack: State[] = [];
  private selected: number | null = null;
  private tool: Tool = 'swim';
  private points: XY[] = [];
  private drag: { type: 'move' | 'resize'; last: XY; box: Bounds; corner?: Corner; scale: number } | null = null;
  private pending: State | null = null;
  private moved = false;
  get playing() { return this.tool === 'swim'; }

  constructor(private readonly canvas: HTMLCanvasElement, private readonly host: Host<State>) {
    const signal = this.events.signal;
    this.toolbar.forEach(button => button.addEventListener('click', () => this.setTool(button.dataset.tool as Tool), { signal }));
    canvas.addEventListener('pointerdown', event => this.down(event), { signal });
    canvas.addEventListener('pointermove', event => this.move(event), { signal });
    canvas.addEventListener('pointerup', event => this.up(event), { signal });
    canvas.addEventListener('pointercancel', () => this.cancel(), { signal });
    document.querySelectorAll<HTMLButtonElement>('[data-corner]').forEach(button => button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      if (this.selected === null) return;
      this.setTool('select');
      const node = host.nodes().find(n => n.id === this.selected);
      if (!node) return;
      this.moved = false;
      this.pending = host.capture();
      this.drag = { type: 'resize', box: { ...node.bounds }, corner: button.dataset.corner as Corner,
        last: this.point(event), scale: 1 };
      this.canvas.setPointerCapture(event.pointerId);
    }, { signal }));
    canvas.addEventListener('lostpointercapture', () => { if (this.pending) this.cancel(); }, { signal });
    document.querySelector<HTMLButtonElement>('[data-delete]')!.addEventListener('click', () => this.remove(), { signal });
    document.querySelector<HTMLButtonElement>('[data-undo]')!.addEventListener('click', () => this.undo(false), { signal });
    document.querySelector<HTMLButtonElement>('[data-redo]')!.addEventListener('click', () => this.undo(true), { signal });
    window.addEventListener('keydown', event => {
      if ((event.target as HTMLElement).matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); this.undo(event.shiftKey); return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') { this.cancel(); this.selected = null; this.setTool('select'); }
      if (event.key.toLowerCase() === 'v') this.setTool('select');
      if (event.key.toLowerCase() === 'p') this.setTool('draw');
      if (event.code === 'Space') { event.preventDefault(); this.setTool(this.playing ? 'select' : 'swim'); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.remove(); }
      const nudges: Record<string, XY> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      if (this.selected !== null && nudges[event.key]) {
        event.preventDefault(); this.setTool('select'); this.remember(host.capture());
        const nudge = nudges[event.key], amount = event.shiftKey ? 10 : 1;
        host.translate(this.selected, nudge.x * amount, nudge.y * amount); host.changed();
      }
    }, { signal });
    window.addEventListener('blur', () => this.cancel(), { signal });
    window.addEventListener('resize', () => this.cancel(), { signal });
    this.setTool('swim');
  }

  private point(event: PointerEvent): XY {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private setTool(tool: Tool) {
    if (this.drag || this.points.length) this.cancel();
    this.tool = tool;
    this.toolbar.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
    this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
    this.hint.textContent = tool === 'draw' ? '윤곽선을 그리면 물고기가 태어나요' : tool === 'select'
      ? '물고기를 선택하고 이동하거나 모서리로 크기를 조절하세요' : '물고기를 누르면 편집할 수 있어요 · P 그리기 · V 선택';
    this.refresh();
  }
  private down(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    const point = this.point(event);
    this.canvas.setPointerCapture(event.pointerId);
    this.moved = false;
    if (this.tool === 'draw') {
      this.points = [point]; this.pending = this.host.capture(); return;
    }
    const node = [...this.host.nodes()].reverse().find(({ bounds: b }) => point.x >= b.x - 5 && point.x <= b.x + b.width + 5 && point.y >= b.y - 5 && point.y <= b.y + b.height + 5);
    this.selected = node?.id ?? null;
    if (node) {
      this.setTool('select'); this.pending = this.host.capture();
      this.drag = { type: 'move', last: point, box: { ...node.bounds }, scale: 1 };
    }
    this.refresh();
  }
  private move(event: PointerEvent) {
    if (!event.isPrimary) return;
    const point = this.point(event);
    if (this.points.length) {
      const last = this.points[this.points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) >= 2 && this.points.length < 4000) this.points.push(point);
      this.outline.setAttribute('d', this.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
    } else if (this.drag && this.selected !== null) {
      if (this.drag.type === 'move') {
        const dx = point.x - this.drag.last.x, dy = point.y - this.drag.last.y;
        this.host.translate(this.selected, dx, dy);
      } else {
        const { pivot, scale } = cornerResize(this.drag.box, this.drag.corner!, point);
        this.drag.scale *= this.host.scale(this.selected, pivot, scale / this.drag.scale);
      }
      this.moved = true; this.drag.last = point; this.host.changed();
    }
  }
  private up(event: PointerEvent) {
    if (!event.isPrimary) return;
    if (this.points.length) {
      const id = this.host.add(this.points);
      if (id >= 0) { this.selected = id; this.moved = true; }
    }
    if (this.moved && this.pending) this.remember(this.pending);
    this.pending = null; this.drag = null; this.points = []; this.outline.setAttribute('d', '');
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (this.selected !== null) this.setTool('select');
    this.host.changed();
  }
  private cancel() {
    if (this.pending && this.moved) this.host.restore(this.pending);
    this.pending = null; this.drag = null; this.moved = false; this.points = []; this.outline.setAttribute('d', '');
    this.host.changed();
  }
  private remember(state: State) {
    this.undoStack.push(state); if (this.undoStack.length > 40) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  private undo(redo: boolean) {
    this.cancel(); this.setTool('select');
    const from = redo ? this.redoStack : this.undoStack, to = redo ? this.undoStack : this.redoStack;
    const state = from.pop();
    if (!state) return;
    to.push(this.host.capture()); this.host.restore(state); this.selected = null; this.host.changed();
  }
  private remove() {
    if (this.selected === null) return;
    this.setTool('select'); this.remember(this.host.capture());
    this.host.remove(this.selected); this.selected = null; this.host.changed();
  }
  refresh() {
    const node = this.host.nodes().find(n => n.id === this.selected);
    this.box.hidden = this.playing || !node;
    if (node && !this.playing) {
      const b = node.bounds;
      Object.assign(this.box.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px` });
      this.label.textContent = `${Math.round(b.width)} × ${Math.round(b.height)}`;
    }
    document.querySelector<HTMLButtonElement>('[data-undo]')!.disabled = !this.undoStack.length;
    document.querySelector<HTMLButtonElement>('[data-redo]')!.disabled = !this.redoStack.length;
  }
  dispose() { this.events.abort(); this.box.hidden = true; this.outline.setAttribute('d', ''); }
}
