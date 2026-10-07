export class StudyError extends Error {
  status: number;
  code: string;
  campo?: string;

  constructor(status: number, code: string, message: string, campo?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.campo = campo;
  }
}
