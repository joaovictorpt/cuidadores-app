"use client";

import { useEffect, useState } from "react";

type IbgeMunicipio = { id: number; nome: string };

type UseIbgeCitiesResult = {
  cities: string[];
  loading: boolean;
  error: string | null;
};

// Busca a lista de cidades de um estado brasileiro na API pública do IBGE.
// Uma falha de rede/API nunca lança erro -- ela aparece como `error` para
// que os chamadores possam recair num input de texto simples em vez de
// deixar o <select> de cidade travado bloqueando o resto do formulário.
export function useIbgeCities(uf: string): UseIbgeCitiesResult {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uf) {
      setCities([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`IBGE respondeu ${response.status}`);
        }
        return response.json() as Promise<IbgeMunicipio[]>;
      })
      .then((municipios) => {
        if (cancelled) return;
        const names = municipios
          .map((municipio) => municipio.nome)
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
        setCities(names);
      })
      .catch(() => {
        if (cancelled) return;
        setCities([]);
        setError(
          "Não foi possível carregar a lista de cidades agora. Digite o nome da cidade manualmente."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [uf]);

  return { cities, loading, error };
}
