-- Corrigir a rota da tela de aguardando aprovação
UPDATE telas_sistema 
SET rota = '/aguardando-aprovacao'
WHERE codigo = 'aguardando' AND rota = '/dashboard/aguardando-aprovacao';