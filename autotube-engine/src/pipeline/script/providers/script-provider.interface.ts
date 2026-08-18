export interface ScriptProvider {
  readonly name: string;
  generateRaw(prompt: string): Promise<string>;
  isTransientError(error: unknown): boolean;
}
