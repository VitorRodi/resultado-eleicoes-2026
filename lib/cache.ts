export class SnapshotCache<T> {
  private value: T | undefined;
  private expires = 0;
  private inFlight: Promise<T> | null = null;
  constructor(private ttl: number, private onError: (last: T | undefined, error: unknown) => T) {}
  peek() { return this.value; }
  async get(loader: (previous: T | undefined) => Promise<T>): Promise<T> {
    if (this.value !== undefined && Date.now() < this.expires) return this.value;
    if (this.inFlight) return this.inFlight;
    this.inFlight = (async () => {
      try { this.value = await loader(this.value); }
      catch (error) { this.value = this.onError(this.value, error); }
      this.expires = Date.now() + this.ttl;
      return this.value!;
    })();
    try { return await this.inFlight; } finally { this.inFlight = null; }
  }
}
