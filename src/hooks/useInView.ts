import { useEffect, useRef, useState } from "react";

/**
 * Observa a visibilidade de um elemento para carregar conteúdo pesado
 * (ex.: URLs assinadas de imagens) apenas quando ele entra na viewport.
 *
 * Uma vez visível, permanece visível (não recarrega ao sair da tela).
 */
export function useInView<T extends HTMLElement = HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
