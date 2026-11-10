-- Migración 001: condensar categorías por defecto.
-- Se ejecuta en cada arranque después de schema.sql; es idempotente:
-- en una base nueva no encuentra nada que mover y no hace nada.

-- 1. El módulo de Presupuesto ya no existe; sus tablas referencian categorías
--    que se van a eliminar, así que se retiran.
DROP TABLE IF EXISTS budget_items;
DROP TABLE IF EXISTS budgets;

-- 2. Reasignar movimientos y gastos fijos de las categorías viejas a las nuevas.
WITH mapa(viejo, nuevo) AS (VALUES
  ('Comida',               'Mercado'),
  ('Entretenimiento',      'Salidas'),
  ('Seguros',              'Seguro carro'),
  ('Mascota',              'Perritas'),
  ('Celular',              'Plan celular'),
  ('Cursos',               'Educación'),
  ('Fondo de emergencia',  'Ahorro'),
  ('Ahorro vehículo',      'Ahorro'),
  ('Ahorro vivienda',      'Ahorro'),
  ('Inversiones',          'Ahorro'),
  ('Cesantías',            'Ahorro'),
  ('Tarjeta de crédito',   'Tarjeta Bancolombia'),
  ('RappiCard',            'Tarjeta Rappi'),
  ('Nequi (crédito)',      'Crédito Nequi'),
  ('ADDI',                 'Crédito ADDI'),
  ('Caja Social',          'Otros créditos'),
  ('Crédito vehículo',     'Otros créditos'),
  ('Otros préstamos',      'Otros créditos'),
  ('Deuda',                'Otros créditos'),
  ('Transporte',           'Extras'),
  ('Ropa',                 'Extras'),
  ('Compras personales',   'Extras'),
  ('Regalos',              'Extras'),
  ('Viajes',               'Extras'),
  ('Streaming',            'Extras'),
  ('Software',             'Extras'),
  ('Dominio',              'Extras'),
  ('Hosting',              'Extras'),
  ('Hogar',                'Extras'),
  ('ChatGPT',              'Extras'),
  ('Claude',               'Extras'),
  ('Otros gastos',         'Extras')
),
pares AS (
  SELECT v.id AS viejo_id, n.id AS nuevo_id
  FROM mapa
  JOIN categories v ON v.name = mapa.viejo AND v.is_default = true AND v.type = 'expense'
  JOIN categories n ON n.name = mapa.nuevo AND n.is_default = true
),
mov AS (
  UPDATE transactions t SET category_id = p.nuevo_id
  FROM pares p WHERE t.category_id = p.viejo_id
  RETURNING 1
),
fij AS (
  UPDATE fixed_expenses f SET category_id = p.nuevo_id
  FROM pares p WHERE f.category_id = p.viejo_id
  RETURNING 1
)
SELECT (SELECT COUNT(*) FROM mov) AS movimientos_movidos,
       (SELECT COUNT(*) FROM fij) AS fijos_movidos;

-- 3. Eliminar las categorías viejas (ya sin referencias).
DELETE FROM categories
WHERE is_default = true AND type = 'expense'
  AND name IN (
    'Comida','Entretenimiento','Seguros','Mascota','Celular','Cursos',
    'Fondo de emergencia','Ahorro vehículo','Ahorro vivienda','Inversiones','Cesantías',
    'Tarjeta de crédito','RappiCard','Nequi (crédito)','ADDI',
    'Caja Social','Crédito vehículo','Otros préstamos','Deuda',
    'Transporte','Ropa','Compras personales','Regalos','Viajes','Streaming',
    'Software','Dominio','Hosting','Hogar','ChatGPT','Claude','Otros gastos'
  );
