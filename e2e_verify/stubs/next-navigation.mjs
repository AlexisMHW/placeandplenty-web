export class NextSignal extends Error { constructor(kind, to) { super(`NEXT_${kind}`); this.kind = kind; this.to = to; } }
export const redirect = (to) => { throw new NextSignal("REDIRECT", to); };
export const notFound = () => { throw new NextSignal("NOT_FOUND"); };
