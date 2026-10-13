export class DeploymentGateError extends Error {
  constructor(public readonly stage: string) { super(stage); }
}
