export class Alerta {
  constructor(
    public readonly id: string,
    public readonly usuarioId: string,
    public readonly reporteId: string,
    public readonly createdAt: Date,
  ) {}
}
