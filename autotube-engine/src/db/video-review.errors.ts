export class VideoNotFoundError extends Error {
  constructor(id: string) {
    super(`Video ${id} not found`);
    this.name = 'VideoNotFoundError';
  }
}

export class ReviewConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewConflictError';
  }
}

export class ReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewValidationError';
  }
}

export class PublishConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishConflictError';
  }
}
