import { describe, it, expect } from 'vitest';
import { extractPathFromUrl } from '../storage-helper';

describe('storage-helper', () => {
  describe('extractPathFromUrl', () => {
    it('deve extrair caminho de URL pública', () => {
      const url = 'https://example.supabase.co/storage/v1/object/public/bucket/file.jpg';
      const path = extractPathFromUrl(url);
      expect(path).toBe('file.jpg');
    });

    it('deve extrair caminho de URL assinada', () => {
      const url = 'https://example.supabase.co/storage/v1/object/sign/bucket/folder/file.jpg?token=abc';
      const path = extractPathFromUrl(url);
      expect(path).toBe('folder/file.jpg');
    });

    it('deve retornar null para URL inválida', () => {
      const path = extractPathFromUrl('not-a-valid-url');
      expect(path).toBeNull();
    });

    it('deve retornar null para URL sem padrão storage', () => {
      const url = 'https://example.com/some/path';
      const path = extractPathFromUrl(url);
      expect(path).toBeNull();
    });
  });
});
