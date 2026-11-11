/** Domain errors are thrown for invalid inputs; never swallowed by core. */

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class IllegalTransitionError extends DomainError {
  constructor(from: string, event: string) {
    super('illegal-transition', `Illegal transition: ${from} -/-> ${event}`);
    this.name = 'IllegalTransitionError';
  }
}

export class BoardInitError extends DomainError {
  constructor(message = 'Level initialization failed, please retry') {
    super('board-init', message);
    this.name = 'BoardInitError';
  }
}
