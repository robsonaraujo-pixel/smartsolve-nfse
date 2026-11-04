export { db, schema } from "../db/index.js";

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}
export const erro = (status: number, msg: string) => new HttpError(status, msg);
