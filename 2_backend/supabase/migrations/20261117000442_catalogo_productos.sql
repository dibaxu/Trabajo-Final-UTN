ALTER TABLE public.products
    ADD COLUMN manual_cost numeric(12, 2)
        CONSTRAINT products_manual_cost_nonnegative CHECK (manual_cost >= 0);

-- Crear los índices antes de retirar las restricciones previas. Si existen
-- duplicados al normalizar, la migración falla y conserva los registros.
CREATE UNIQUE INDEX product_categories_name_normalized_unique
    ON public.product_categories (lower(btrim(name)));
CREATE UNIQUE INDEX products_sku_normalized_unique
    ON public.products (lower(btrim(sku))) WHERE sku IS NOT NULL;

ALTER TABLE public.product_categories DROP CONSTRAINT product_categories_name_key;
ALTER TABLE public.products DROP CONSTRAINT products_sku_key;
