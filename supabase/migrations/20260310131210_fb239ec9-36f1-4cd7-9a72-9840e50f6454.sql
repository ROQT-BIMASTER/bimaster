INSERT INTO public.profiles (id, nome, email, aprovado, departamento_id)
VALUES
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'Luana do Nascimento Bazilio', 'l.bazilio@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('ef248937-6635-4058-98ac-f3d0b2199f4f', 'Leticia Leite', 'l.leite@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('a47fb658-c313-4471-82f0-0091bb9227e7', 'Giovanna Leme Costa e Silva', 'g.silva@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('406e1214-968c-466e-b508-f1d2a103f1c9', 'Sabrina Martins', 's.martins@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('0b8a8b5e-b352-4de2-8d32-69a4229328b1', 'Janaine Freitas', 'j.freitas@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'Claudia Tiemi Nakano', 'c.nakano@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('4922cdf1-b604-46ca-b0f4-409149d10a95', 'Debora Rosa de Sá Novaes', 'd.rosa@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('ea750e42-5e8c-4c19-b937-ffc4d3ee44eb', 'Victoria Gratiana Guarita', 'v.gratiana@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('139d024c-c2ed-42d2-99f7-a605782004bf', 'Daniele da Conceição Silva', 'd.silva@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('3346a01c-7b8b-47af-b71d-d765b8d7b2e5', 'Julia Dario', 'j.dario@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('8a293dbe-10f1-4a64-9e95-28f28b89c725', 'Thais Moraes', 't.moraes@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130'),
  ('f3a0c703-dd7e-4363-a154-6d001772ce51', 'Milena Lacerda', 'milena.lacerda@rubyrose.com.br', true, '9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('2f3df7bd-7db9-404a-8093-d80168ceab70', 'gerente'),
  ('ef248937-6635-4058-98ac-f3d0b2199f4f', 'vendedor'),
  ('a47fb658-c313-4471-82f0-0091bb9227e7', 'vendedor'),
  ('406e1214-968c-466e-b508-f1d2a103f1c9', 'vendedor'),
  ('0b8a8b5e-b352-4de2-8d32-69a4229328b1', 'vendedor'),
  ('8503e184-3c98-4cb8-9cf0-e32ae6bc0096', 'vendedor'),
  ('4922cdf1-b604-46ca-b0f4-409149d10a95', 'vendedor'),
  ('ea750e42-5e8c-4c19-b937-ffc4d3ee44eb', 'vendedor'),
  ('139d024c-c2ed-42d2-99f7-a605782004bf', 'vendedor'),
  ('3346a01c-7b8b-47af-b71d-d765b8d7b2e5', 'vendedor'),
  ('8a293dbe-10f1-4a64-9e95-28f28b89c725', 'vendedor'),
  ('f3a0c703-dd7e-4363-a154-6d001772ce51', 'vendedor')
ON CONFLICT (user_id, role) DO NOTHING