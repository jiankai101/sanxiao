export interface RecordedCall {
  op: string;
  args: unknown[];
}

export interface MockContext {
  calls: RecordedCall[];
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  strokeRect: (x: number, y: number, w: number, h: number) => void;
  drawImage: (image: unknown, x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  arc: (x: number, y: number, r: number, s: number, e: number) => void;
  fill: () => void;
  stroke: () => void;
  save: () => void;
  restore: () => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
}

export function createMockContext(): MockContext {
  const calls: RecordedCall[] = [];
  const record = (op: string) => (...args: unknown[]) => {
    calls.push({ op, args });
  };
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: record('fillRect') as MockContext['fillRect'],
    strokeRect: record('strokeRect') as MockContext['strokeRect'],
    drawImage: record('drawImage') as MockContext['drawImage'],
    fillText: record('fillText') as MockContext['fillText'],
    beginPath: record('beginPath') as MockContext['beginPath'],
    moveTo: record('moveTo') as MockContext['moveTo'],
    lineTo: record('lineTo') as MockContext['lineTo'],
    closePath: record('closePath') as MockContext['closePath'],
    arc: record('arc') as MockContext['arc'],
    fill: record('fill') as MockContext['fill'],
    stroke: record('stroke') as MockContext['stroke'],
    save: record('save') as MockContext['save'],
    restore: record('restore') as MockContext['restore'],
    clearRect: record('clearRect') as MockContext['clearRect'],
    setTransform: record('setTransform') as MockContext['setTransform'],
  };
}

export function callsOf(ctx: MockContext, op: string): RecordedCall[] {
  return ctx.calls.filter((call) => call.op === op);
}
