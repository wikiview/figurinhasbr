const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

export async function getCitiesByUF(uf: string): Promise<string[]> {
  const key = uf.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios?orderBy=nome`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const json = (await res.json()) as { nome: string }[];
    const names = json.map((c) => c.nome);
    cache.set(key, names);
    return names;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}
