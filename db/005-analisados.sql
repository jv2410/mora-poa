-- Aditiva: quantos imóveis o motor varreu naquela busca.
--
-- Antes o painel somava alta + vale_apresentar, ou seja, o que a busca
-- devolveu. Mas o que prova escala é o que foi analisado: o filtro percorre o
-- estoque inteiro para separar meia dúzia. Somar só o resultado subestima o
-- trabalho em uma ordem de grandeza e torna "horas economizadas" irreconhecível.
ALTER TABLE buscas ADD COLUMN IF NOT EXISTS analisados int;
