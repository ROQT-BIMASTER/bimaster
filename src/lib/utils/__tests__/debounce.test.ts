import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve atrasar execução da função', () => {
    const func = vi.fn();
    const debounced = debounce(func, 1000);

    debounced();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(func).toHaveBeenCalledOnce();
  });

  it('deve cancelar execuções anteriores', () => {
    const func = vi.fn();
    const debounced = debounce(func, 1000);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(1000);
    expect(func).toHaveBeenCalledOnce();
  });

  it('deve passar argumentos corretamente', () => {
    const func = vi.fn();
    const debounced = debounce(func, 1000);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(1000);

    expect(func).toHaveBeenCalledWith('arg1', 'arg2');
  });
});
