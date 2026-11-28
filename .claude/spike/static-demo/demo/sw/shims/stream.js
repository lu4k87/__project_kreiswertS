// Node streams are only referenced by code paths the worker never takes (pipeable rendering); web streams are used instead.
export class Readable {}
export class Writable {}
export class Duplex {}
export class Transform {}
export class PassThrough {}
export default { Readable, Writable, Duplex, Transform, PassThrough };
