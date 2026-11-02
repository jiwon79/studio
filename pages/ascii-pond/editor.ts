import { cornerResize, edgeResize, type Bounds, type Corner, type Edge, type XY } from './editor-model';

interface Host<State> {
  nodes(): { id: number; bounds: Bounds }[];
  add(points: XY[]): number;
  translate(id: number, dx: number, dy: number): void;
  scale(id: number, pivot: XY, ratio: number): number;
  stretch(id: number, pivot: XY, axis: 'x' | 'y', ratio: number): number;
  remove(id: number): void;
  splash(point: XY): void;
  capture(): State;
  restore(state: State, id: number): void;
  changed(): void;
}

export class PondEditor<State> {
  private readonly events = new AbortController();
  private readonly box = document.querySelector<HTMLElement>('.selection')!;
  private readonly label = document.querySelector<HTMLElement>('.selection-size')!;
  private readonly hoverBox = document.querySelector<HTMLElement>('.hover-outline')!;
  private readonly outline = document.querySelector<SVGPathElement>('.sketch path')!;
  private readonly undoStack: { state: State; id: number }[] = [];
  private readonly redoStack: { state: State; id: number }[] = [];
  private selected: number | null = null;
  private points: XY[] = [];
  private drag: { type: 'move' | 'resize'; last: XY; box: Bounds; corner?: Corner; edge?: Edge; scale: number } | null = null;
  private pending: State | null = null;
  private activePointer: number | null = null;
  private moved = false;
  private hoverPoint: XY | null = null;
  private lastTap: { point: XY; time: number } | null = null;
  private lastSplash = -Infinity;
  get selectedId() { return this.selected; }

  constructor(private readonly canvas: HTMLCanvasElement, private readonly host: Host<State>) {
    const signal = this.events.signal;
    canvas.addEventListener('pointerdown', event => this.down(event), { signal });
    canvas.addEventListener('pointermove', event => this.move(event), { signal });
    canvas.addEventListener('pointerup', event => this.up(event), { signal });
    canvas.addEventListener('pointercancel', event => {
      if (event.pointerId === this.activePointer) this.finishGesture();
    }, { signal });
    canvas.addEventListener('pointerleave', () => { this.hoverPoint = null; this.hoverBox.hidden = true; }, { signal });
    canvas.addEventListener('dblclick', event => {
      this.splash(this.point(event));
    }, { signal });
    document.querySelectorAll<HTMLButtonElement>('[data-corner], [data-edge]').forEach(button => button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || this.activePointer !== null) return;
      event.preventDefault();
      if (this.selected === null) return;
      const node = host.nodes().find(n => n.id === this.selected);
      if (!node) return;
      this.activePointer = event.pointerId;
      this.moved = false;
      this.pending = host.capture();
      this.drag = { type: 'resize', box: { ...node.bounds }, corner: button.dataset.corner as Corner, edge: button.dataset.edge as Edge,
        last: this.point(event), scale: 1 };
      this.canvas.setPointerCapture(event.pointerId);
    }, { signal }));
    canvas.addEventListener('lostpointercapture', event => {
      if (event.pointerId === this.activePointer && !canvas.hasPointerCapture(event.pointerId)) this.finishGesture();
    }, { signal });
    window.addEventListener('keydown', event => {
      if ((event.target as HTMLElement).matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); this.undo(event.shiftKey); return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') { this.cancel(); this.selected = null; this.refresh(); }
      if (event.code === 'Space') { event.preventDefault(); this.cancel(); this.selected = null; this.refresh(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.remove(); }
      const nudges: Record<string, XY> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      if (this.selected !== null && nudges[event.key]) {
        event.preventDefault(); this.cancel(); this.remember(host.capture(), this.selected);
        const nudge = nudges[event.key], amount = event.shiftKey ? 10 : 1;
        host.translate(this.selected, nudge.x * amount, nudge.y * amount); host.changed();
      }
    }, { signal });
    window.addEventListener('blur', () => this.finishGesture(), { signal });
    window.addEventListener('resize', () => this.finishGesture(), { signal });
    this.refresh();
  }

  private point(event: MouseEvent): XY {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private down(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || this.activePointer !== null) return;
    const point = this.point(event);
    this.activePointer = event.pointerId;
    this.canvas.setPointerCapture(event.pointerId);
    this.moved = false;
    const node = [...this.host.nodes()].reverse().find(({ bounds: b }) => point.x >= b.x - 5 && point.x <= b.x + b.width + 5 && point.y >= b.y - 5 && point.y <= b.y + b.height + 5);
    this.selected = node?.id ?? null;
    if (node) {
      this.pending = this.host.capture();
      this.drag = { type: 'move', last: point, box: { ...node.bounds }, scale: 1 };
    } else {
      this.points = [point];
      this.pending = this.host.capture();
    }
    this.host.changed(); this.refresh();
  }
  private move(event: PointerEvent) {
    if (!event.isPrimary || (this.activePointer !== null && event.pointerId !== this.activePointer)) return;
    const point = this.point(event);
    this.hoverPoint = event.pointerType === 'touch' ? null : point;
    if (this.points.length) {
      if (Math.hypot(point.x - this.points[0].x, point.y - this.points[0].y) >= 6) this.moved = true;
      const last = this.points[this.points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) >= 2 && this.points.length < 4000) this.points.push(point);
      this.outline.setAttribute('d', this.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
    } else if (this.drag && this.selected !== null) {
      if (this.drag.type === 'move') {
        const dx = point.x - this.drag.last.x, dy = point.y - this.drag.last.y;
        this.host.translate(this.selected, dx, dy);
      } else {
        if (this.drag.edge) {
          const { pivot, axis, scale } = edgeResize(this.drag.box, this.drag.edge, point);
          this.drag.scale *= this.host.stretch(this.selected, pivot, axis, scale / this.drag.scale);
        } else {
          const { pivot, scale } = cornerResize(this.drag.box, this.drag.corner!, point);
          this.drag.scale *= this.host.scale(this.selected, pivot, scale / this.drag.scale);
        }
      }
      this.moved = true; this.drag.last = point; this.host.changed();
    } else this.refresh();
  }
  private up(event: PointerEvent) {
    if (event.pointerId !== this.activePointer) return;
    // The final pointer position can arrive without a preceding move event.
    const point = this.point(event);
    const last = this.drag?.last ?? this.points[this.points.length - 1];
    if (last && (point.x !== last.x || point.y !== last.y)) this.move(event);
    if (this.points.length) {
      const id = this.host.add(this.points);
      if (id >= 0) {
        if (this.pending) this.remember(this.pending, id);
        this.moved = true;
        this.hoverPoint = null;
      }
      // New fish swim immediately; creation history does not require selection.
      this.selected = null;
    }
    const isTap = !this.moved && event.pointerType !== 'mouse';
    this.finishGesture();
    if (isTap) {
      if (this.lastTap && event.timeStamp - this.lastTap.time < 350
        && Math.hypot(point.x - this.lastTap.point.x, point.y - this.lastTap.point.y) < 24) {
        this.splash(point); this.lastTap = null;
      } else this.lastTap = { point, time: event.timeStamp };
    } else this.lastTap = null;
  }
  private splash(point: XY) {
    if (performance.now() - this.lastSplash < 250) return;
    this.lastSplash = performance.now();
    this.selected = null;
    this.host.splash(point); this.host.changed(); this.refresh();
  }
  /** Interrupted drags retain their last pose. Only explicit cancellation rolls back. */
  private finishGesture(rollback = false) {
    if (this.activePointer === null) return;
    if (this.pending && this.moved && this.selected !== null) {
      if (rollback) this.host.restore(this.pending, this.selected);
      else this.remember(this.pending, this.selected);
    }
    const pointer = this.activePointer;
    // Clear ownership before releasing capture: its lost event may arrive later.
    this.activePointer = null;
    this.pending = null; this.drag = null; this.moved = false; this.points = []; this.outline.setAttribute('d', '');
    if (this.canvas.hasPointerCapture(pointer)) this.canvas.releasePointerCapture(pointer);
    this.host.changed();
  }
  private cancel() { this.finishGesture(true); }
  private remember(state: State, id: number) {
    this.undoStack.push({ state, id }); if (this.undoStack.length > 40) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  private undo(redo: boolean) {
    this.cancel();
    const from = redo ? this.redoStack : this.undoStack, to = redo ? this.undoStack : this.redoStack;
    const state = from.pop();
    if (!state) return;
    to.push({ state: this.host.capture(), id: state.id });
    this.host.restore(state.state, state.id); this.selected = null; this.host.changed();
  }
  private remove() {
    if (this.selected === null) return;
    this.cancel(); this.remember(this.host.capture(), this.selected);
    this.host.remove(this.selected); this.selected = null; this.host.changed();
  }
  refresh() {
    const nodes = this.host.nodes();
    const node = nodes.find(n => n.id === this.selected);
    this.box.hidden = !node;
    if (node) {
      const b = node.bounds;
      this.label.textContent = `${Math.round(b.width)} × ${Math.round(b.height)}`;
      Object.assign(this.box.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px` });
    }
    const hovered = this.hoverPoint && !this.points.length && !this.drag
      ? [...nodes].reverse().find(({ bounds: b }) => this.hoverPoint!.x >= b.x - 5 && this.hoverPoint!.x <= b.x + b.width + 5
        && this.hoverPoint!.y >= b.y - 5 && this.hoverPoint!.y <= b.y + b.height + 5) : null;
    this.hoverBox.hidden = !hovered || hovered.id === this.selected;
    if (hovered && hovered.id !== this.selected) {
      const b = hovered.bounds;
      Object.assign(this.hoverBox.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px` });
    }
    if (!this.drag) this.canvas.style.cursor = this.points.length ? 'crosshair' : hovered ? 'move' : 'default';
  }
  dispose() { this.events.abort(); this.box.hidden = true; this.hoverBox.hidden = true; this.outline.setAttribute('d', ''); }
}
