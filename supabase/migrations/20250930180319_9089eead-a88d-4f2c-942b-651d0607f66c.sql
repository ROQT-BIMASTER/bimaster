-- Promover leandro.moraesramos@gmail.com para admin
UPDATE profiles 
SET tipo_usuario = 'admin'
WHERE email = 'leandro.moraesramos@gmail.com';