/** An error whose message is safe to show to the end user. */
export class UserError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}
